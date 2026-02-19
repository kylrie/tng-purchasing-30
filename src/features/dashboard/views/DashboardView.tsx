import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Clock,
    FileText,
    Receipt,
    AlertTriangle,
    Timer,
    CheckCircle2,
    Users,
    Wallet,
    Coins,
    ShieldCheck
} from 'lucide-react';
import PesoSign from '../../../shared/components/PesoSign';
import DashboardCard from '../components/DashboardCard';
import type { Requisition, Supplier } from '../../procurement/types';
import { RequisitionStatus, isSuperAdmin } from '../../procurement/types';
import type { User, Business } from '../../../shared/types';
import { executeWorkflowAction } from '../../procurement/services/workflowService';
import { usePermissions } from '../../../hooks/usePermissions';
import PreparePRFModal from '../../procurement/components/PreparePRFModal';
import ReleaseFundModal from '../../finance/components/ReleaseFundModal';
import LiquidationAuditModal from '../../finance/components/LiquidationAuditModal';
import { RequisitionService } from '../../procurement/services/requisitions.service';
import RejectionModal from '../../../shared/components/RejectionModal';
import RequisitionDrawer from '../../../shared/components/RequisitionDrawer';
import { CheckCircle, XCircle, Briefcase, Square, CheckSquare } from 'lucide-react';
import { SettingsService, type ApproverAssignments } from '../../../shared/services/settings.service';
import { PCFService } from '../../finance/services/pcf.service';

interface DashboardViewProps {
    requisitions: Requisition[];
    currentUser: User;
    allUsers: User[];
    suppliers: Supplier[];
    businesses: Business[];
    onCreateRequisition: (req: Omit<Requisition, 'id'> | Requisition) => void;
    onUpdateRequisition: (req: Requisition) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ requisitions, currentUser, allUsers, suppliers, businesses, onCreateRequisition, onUpdateRequisition }) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const { hasPermission } = usePermissions();
    const [preparePRFReq, setPreparePRFReq] = React.useState<Requisition | null>(null);
    const [releaseFundReq, setReleaseFundReq] = React.useState<Requisition | null>(null);
    const [auditReq, setAuditReq] = React.useState<Requisition | null>(null);
    const [rejectingReq, setRejectingReq] = React.useState<Requisition | null>(null);
    const [drawerReq, setDrawerReq] = React.useState<Requisition | null>(null);
    const [selectedBU, setSelectedBU] = React.useState<string>('all');
    const [pendingApprovalTab, setPendingApprovalTab] = React.useState<'burf' | 'cic' | 'prf' | 'gmprf'>('burf');

    // Workflow Approver Assignments for filtering
    const [approverAssignments, setApproverAssignments] = React.useState<ApproverAssignments>({});

    // PCF Pending Count - real data from service
    const [pcfPendingCount, setPcfPendingCount] = React.useState<number>(0);

    // Bulk selection for Check Authorization
    const [selectedCheckAuthIds, setSelectedCheckAuthIds] = React.useState<Set<string>>(new Set());
    const [bulkRejectMode, setBulkRejectMode] = React.useState<boolean>(false);
    const [checkAuthBuFilter, setCheckAuthBuFilter] = React.useState<string>('all');

    // Bulk selection for Finance Head BR
    const [selectedFinanceBRIds, setSelectedFinanceBRIds] = React.useState<Set<string>>(new Set());
    const [financeBRBuFilter, setFinanceBRBuFilter] = React.useState<string>('all');

    // Bulk selection for GM BR
    const [selectedGmBRIds, setSelectedGmBRIds] = React.useState<Set<string>>(new Set());
    const [gmBRBuFilter, setGmBRBuFilter] = React.useState<string>('all');

    // Bulk selection for BOD BR
    const [selectedBodBRIds, setSelectedBodBRIds] = React.useState<Set<string>>(new Set());
    const [bodBRBuFilter, setBodBRBuFilter] = React.useState<string>('all');

    // Bulk selection for Pending Approvals
    const [selectedPendingApprovalIds, setSelectedPendingApprovalIds] = React.useState<Set<string>>(new Set());


    // Load approver assignments and PCF pending count on mount
    React.useEffect(() => {
        SettingsService.getApproverAssignments().then(setApproverAssignments);

        // Fetch real PCF pending count
        if (hasPermission('pcf:approve')) {
            PCFService.getPendingLiquidations()
                .then(liquidations => setPcfPendingCount(liquidations.length))
                .catch(() => setPcfPendingCount(0));
        }
    }, [hasPermission]);



    // PRF Modal is opened directly by setPreparePRFReq - no redirect needed



    // Helper to check if user is assigned to a workflow role
    const isAssignedApprover = (r: Requisition): boolean => {
        switch (r.status) {
            // BU-specific Finance Head - check if user handles this BU
            case RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL:
                if (approverAssignments.financeHeads) {
                    return approverAssignments.financeHeads.some(fh =>
                        fh.userId === currentUser.id &&
                        fh.businessUnitIds.includes(r.businessId)
                    );
                }
                return false;

            case RequisitionStatus.PENDING_GM_PRF_APPROVAL:
            case RequisitionStatus.PENDING_GM_BR_APPROVAL:
                return currentUser.id === approverAssignments.gmUid;

            case RequisitionStatus.PENDING_CFO_APPROVAL:
                return currentUser.id === approverAssignments.cfoUid;

            // Multiple BOD approvers - any of them can approve
            case RequisitionStatus.PENDING_BOD_APPROVAL:
                if (approverAssignments.bodApprovers) {
                    return approverAssignments.bodApprovers.some(bod =>
                        bod.userId === currentUser.id
                    );
                }
                return false;

            case RequisitionStatus.FOR_FUND_RELEASE:
                return hasPermission('finance:release_funds');
            default:
                return false;
        }
    };

    // Note: pendingCount removed - now using individual counts per approval type
    const totalSpend = requisitions
        .filter(r => [RequisitionStatus.APPROVED_FOR_PAYMENT, RequisitionStatus.FUNDS_RELEASED, RequisitionStatus.LIQUIDATION_FILED, RequisitionStatus.AUDITED_CLEARED].includes(r.status))
        .filter(r => selectedBU === 'all' || r.businessId === selectedBU)
        .reduce((sum, r) => sum + r.totalAmount, 0);

    // Business filter options for Total Spend widget
    const businessFilterOptions = [
        { value: 'all', label: 'All BUs' },
        ...businesses.map(b => ({ value: b.id, label: b.name }))
    ];

    // For PRF Count (includes BURF_PARTIALLY_PROCESSED for multi-batch PRF creation)
    const forPrfCount = requisitions.filter(r =>
        r.status === RequisitionStatus.READY_FOR_PRF ||
        r.status === RequisitionStatus.BURF_PARTIALLY_PROCESSED
    ).length;

    // === NEW METRICS FOR MANAGERS ===

    // Overdue Items - past dateNeeded and not completed
    const now = new Date();
    const overdueItems = requisitions.filter(r => {
        if (!r.dateNeeded) return false;
        const needed = new Date(r.dateNeeded);
        const isOverdue = needed < now;
        const isNotCompleted = ![
            RequisitionStatus.FUNDS_RELEASED,
            RequisitionStatus.AUDITED_CLEARED,
            RequisitionStatus.CANCELLED,
            RequisitionStatus.REJECTED
        ].includes(r.status);
        return isOverdue && isNotCompleted;
    });
    const overdueCount = overdueItems.length;

    // Average Processing Time (days from BURF creation to fund release)
    const completedReqs = requisitions.filter(r =>
        r.status === RequisitionStatus.FUNDS_RELEASED && r.fundReleaseDate
    );
    const avgProcessingDays = completedReqs.length > 0
        ? Math.round(completedReqs.reduce((sum, r) => {
            const created = new Date(r.dateCreated).getTime();
            const released = new Date(r.fundReleaseDate!).getTime();
            return sum + (released - created) / (1000 * 60 * 60 * 24);
        }, 0) / completedReqs.length)
        : 0;

    // Completed This Month vs Last Month
    const thisMonth = new Date();
    const lastMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() - 1, 1);
    const thisMonthStart = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);

    const completedThisMonth = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.FUNDS_RELEASED || !r.fundReleaseDate) return false;
        const released = new Date(r.fundReleaseDate);
        return released >= thisMonthStart;
    }).length;

    const completedLastMonth = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.FUNDS_RELEASED || !r.fundReleaseDate) return false;
        const released = new Date(r.fundReleaseDate);
        return released >= lastMonth && released < thisMonthStart;
    }).length;

    const monthlyTrendPercent = completedLastMonth > 0
        ? Math.round(((completedThisMonth - completedLastMonth) / completedLastMonth) * 100)
        : completedThisMonth > 0 ? 100 : 0;

    // Top 5 Requesters
    const requesterCounts: Record<string, { name: string; count: number }> = {};
    requisitions.forEach(r => {
        const requester = allUsers.find(u => u.id === r.requesterId);
        const name = requester?.name || 'Unknown';
        if (!requesterCounts[r.requesterId]) {
            requesterCounts[r.requesterId] = { name, count: 0 };
        }
        requesterCounts[r.requesterId].count++;
    });
    const top5Requesters = Object.entries(requesterCounts)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([id, data]) => ({ id, ...data }));

    const pendingApprovals = [...requisitions]
        .filter(r => {
            // Super Admin / Global View - see all pending
            if (hasPermission('requisition:view:all') && hasPermission('admin:manage:users')) {
                return [
                    RequisitionStatus.BURF_PENDING_MANAGER,
                    RequisitionStatus.BURF_PENDING_CIC,
                    RequisitionStatus.PRF_PENDING_MANAGER,
                    RequisitionStatus.PENDING_GM_PRF_APPROVAL,
                    RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL,
                    RequisitionStatus.PENDING_GM_BR_APPROVAL,
                    RequisitionStatus.PENDING_CFO_APPROVAL,
                    RequisitionStatus.PENDING_BOD_APPROVAL,
                    RequisitionStatus.FOR_FUND_RELEASE,
                    RequisitionStatus.APPROVED_FOR_PAYMENT // Legacy
                ].includes(r.status);
            }

            // Permission-based checks
            if (hasPermission('approval:manager:burf') && r.status === RequisitionStatus.BURF_PENDING_MANAGER) return true;
            if (hasPermission('approval:cic:burf') && r.status === RequisitionStatus.BURF_PENDING_CIC) return true;
            if (hasPermission('finance:release_funds') && r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) return true;

            // PRF_PENDING_MANAGER: Check based on source type
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) {
                // BURF→PRF conversions: Use BUM role-based approval
                if (r.parentBurfId) {
                    return hasPermission('approval:manager:prf');
                } else {
                    // Direct PRF: Use designated approver
                    return r.prfDetails?.designatedApproverId === currentUser.id;
                }
            }

            // New workflow - check assigned approver
            if (isAssignedApprover(r)) return true;

            return false;
        })
        .sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime())
        .map(r => {
            let action = 'needs approval';
            if (r.status === RequisitionStatus.BURF_PENDING_MANAGER) action = 'submitted BURF';
            if (r.status === RequisitionStatus.BURF_PENDING_CIC) action = 'approved BURF';
            if (r.status === RequisitionStatus.PRF_PENDING_MANAGER) action = 'PRF for Approval';
            if (r.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL) action = 'PRF for GM (≥50k)';
            if (r.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL) action = 'PRF for Finance Head';
            if (r.status === RequisitionStatus.PENDING_GM_BR_APPROVAL) action = 'PRF for GM Budget';
            if (r.status === RequisitionStatus.PENDING_CFO_APPROVAL) action = 'PRF for CFO';
            if (r.status === RequisitionStatus.PENDING_BOD_APPROVAL) action = 'PRF for BOD';
            if (r.status === RequisitionStatus.FOR_FUND_RELEASE) action = 'Ready for Fund Release';
            if (r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) action = 'Ready for Payment';

            const requester = allUsers.find(u => u.id === r.requesterId);
            const requesterName = requester?.name || 'Unknown User';

            return {
                id: r.id,
                user: requesterName,
                action,
                target: r.projectName || r.description,
                time: new Date(r.dateCreated).toLocaleDateString(),
                avatar: requesterName.charAt(0).toUpperCase(),
                status: r.status,
                rawRequisition: r // Pass the full object for actions
            };
        });

    // === SECONDARY TABS: Split pending approvals into categories ===
    // Tab 1: BURF Approvals (BURF_PENDING_MANAGER only)
    const burfApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.BURF_PENDING_MANAGER
    );

    // Tab 2: CIC Reviews (Check Prep tasks)
    const cicReviews = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.BURF_PENDING_CIC
    );

    // Tab 3: PRF Approvals (PRF Step 1 - Manager/Designated Approver ONLY)
    const prfApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PRF_PENDING_MANAGER
    );

    // Tab 4: GM PRF Approvals (Step 2 - General Manager for items >= 50k)
    const gmPrfApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL
    );

    // BR (Budget Request) - Steps 3-5: Finance Head, GM Budget, CFO
    const brApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL ||
        item.status === RequisitionStatus.PENDING_GM_BR_APPROVAL ||
        item.status === RequisitionStatus.PENDING_CFO_APPROVAL
    );

    // Check Authorization (BOD Approval - Step 6)
    const checkAuthApprovals = pendingApprovals.filter(item =>
        item.status === RequisitionStatus.PENDING_BOD_APPROVAL
    );

    // Get current tab's data
    const getActiveTabItems = () => {
        switch (pendingApprovalTab) {
            case 'burf': return burfApprovals;
            case 'cic': return cicReviews;
            case 'prf': return prfApprovals;
            case 'gmprf': return gmPrfApprovals;
            default: return burfApprovals;
        }
    };






    // Ready for PRF Items (Purchasing Officer View)
    // Includes both READY_FOR_PRF and BURF_PARTIALLY_PROCESSED (for multi-batch PRF creation)
    const readyForPrfItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.READY_FOR_PRF &&
            r.status !== RequisitionStatus.BURF_PARTIALLY_PROCESSED) return false;
        if (!hasPermission('requisition:create:prf')) return false;

        // Filter by Business Unit
        if (hasPermission('requisition:view:all')) return true;

        const userBUs = currentUser.businessUnitIds || [currentUser.businessId];
        return userBUs.includes(r.businessId);
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // Pending Fund Release (Finance) - includes both legacy and new workflow statuses
    const pendingFundReleaseItems = requisitions.filter(r =>
        (r.status === RequisitionStatus.FOR_FUND_RELEASE ||
            r.status === RequisitionStatus.APPROVED_FOR_PAYMENT) &&
        hasPermission('finance:release_funds')
    );

    // Finance Head BR Items - BU-specific filtering with permission fallback
    const financeHeadBRItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL) return false;

        // Option 1: Check if current user is a Finance Head for this requisition's BU
        if (approverAssignments.financeHeads) {
            const isAssignedForBU = approverAssignments.financeHeads.some(fh =>
                fh.userId === currentUser.id &&
                fh.businessUnitIds.includes(r.businessId)
            );
            if (isAssignedForBU) return true;
        }

        // REMOVED: Fallback permission bypass - Finance Heads must be assigned to specific BUs
        // This ensures proper BU-based access control

        return false;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // GM BR Items - GM Budget Review approval
    const gmBRItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_GM_BR_APPROVAL) return false;

        // Only the assigned GM can see these
        return currentUser.id === approverAssignments.gmUid;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // BOD BR Items - BOD Budget Review approval
    const bodBRItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_BOD_APPROVAL) return false;

        // Option 1: Check if current user is assigned as BOD approver
        if (approverAssignments.bodApprovers) {
            const isAssignedBOD = approverAssignments.bodApprovers.some(bod =>
                bod.userId === currentUser.id
            );
            if (isAssignedBOD) return true;
        }

        // Option 2: Fallback - if user has BOD approval permission
        if (hasPermission('approval:bod')) return true;

        return false;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // Check Authorization Items - Filter by BOD role assignment OR permission
    const checkAuthItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_CHECK_AUTH_BOD) return false;

        // SuperAdmins and users with BOD approval permission can always see
        if (hasPermission('approval:bod')) return true;

        // BOD approvers assigned in settings can approve check authorization
        const bodApprovers = approverAssignments.bodApprovers;
        if (bodApprovers && bodApprovers.length > 0) {
            return bodApprovers.some(bod =>
                bod.userId === currentUser.id
            );
        }

        return false;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // Get unique business units from check auth items for filter dropdown
    const checkAuthBuOptions = React.useMemo(() => {
        const uniqueBuIds = [...new Set(checkAuthItems.map(r => r.businessId))];
        const buList = uniqueBuIds
            .map(id => businesses.find(b => b.id === id))
            .filter((b): b is typeof businesses[0] => !!b)
            .sort((a, b) => a.name.localeCompare(b.name));
        return [{ value: 'all', label: 'All Business Units' }, ...buList.map(b => ({ value: b.id, label: b.name }))];
    }, [checkAuthItems, businesses]);

    // Filtered check auth items based on BU selection
    const filteredCheckAuthItems = React.useMemo(() => {
        if (checkAuthBuFilter === 'all') return checkAuthItems;
        return checkAuthItems.filter(r => r.businessId === checkAuthBuFilter);
    }, [checkAuthItems, checkAuthBuFilter]);

    // CFO Approval Items - Only for assigned CFO
    const cfoPendingItems = requisitions.filter(r => {
        if (r.status !== RequisitionStatus.PENDING_CFO_APPROVAL) return false;
        return currentUser.id === approverAssignments.cfoUid;
    }).sort((a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());

    // Pending Audit (Auditor)
    const pendingAuditItems = requisitions.filter(r =>
        r.status === RequisitionStatus.LIQUIDATION_FILED &&
        hasPermission('liquidation:audit')
    );

    // Consolidated Deep Linking & Notification Handling
    React.useEffect(() => {
        const tab = searchParams.get('tab');
        const id = searchParams.get('id');

        // 1. Handle Tab Switching
        if (tab && ['burf', 'cic', 'prf', 'gmprf'].includes(tab)) {
            setPendingApprovalTab(tab as any);
        }

        // 2. Handle ID-based Navigation
        if (id) {
            // Find the requisition in the main list
            const req = requisitions.find(r => r.id === id);

            if (req) {
                // Always Open Drawer (Default behavior for all notifications)
                if (!drawerReq && !preparePRFReq) {
                    setDrawerReq(req);
                }
            }
        }
    }, [searchParams, requisitions, readyForPrfItems, preparePRFReq, drawerReq]);

    // ========== BU OPTIONS AND FILTERED ITEMS FOR ALL WIDGETS ==========

    // Finance Head BR - BU Options & Filtered
    const financeBRBuOptions = React.useMemo(() => {
        const uniqueBuIds = [...new Set(financeHeadBRItems.map(r => r.businessId))];
        const buList = uniqueBuIds.map(id => businesses.find(b => b.id === id)).filter((b): b is typeof businesses[0] => !!b).sort((a, b) => a.name.localeCompare(b.name));
        return [{ value: 'all', label: 'All Business Units' }, ...buList.map(b => ({ value: b.id, label: b.name }))];
    }, [financeHeadBRItems, businesses]);
    const filteredFinanceBRItems = React.useMemo(() => {
        if (financeBRBuFilter === 'all') return financeHeadBRItems;
        return financeHeadBRItems.filter(r => r.businessId === financeBRBuFilter);
    }, [financeHeadBRItems, financeBRBuFilter]);

    // GM BR - BU Options & Filtered
    const gmBRBuOptions = React.useMemo(() => {
        const uniqueBuIds = [...new Set(gmBRItems.map(r => r.businessId))];
        const buList = uniqueBuIds.map(id => businesses.find(b => b.id === id)).filter((b): b is typeof businesses[0] => !!b).sort((a, b) => a.name.localeCompare(b.name));
        return [{ value: 'all', label: 'All Business Units' }, ...buList.map(b => ({ value: b.id, label: b.name }))];
    }, [gmBRItems, businesses]);
    const filteredGmBRItems = React.useMemo(() => {
        if (gmBRBuFilter === 'all') return gmBRItems;
        return gmBRItems.filter(r => r.businessId === gmBRBuFilter);
    }, [gmBRItems, gmBRBuFilter]);

    // BOD BR - BU Options & Filtered
    const bodBRBuOptions = React.useMemo(() => {
        const uniqueBuIds = [...new Set(bodBRItems.map(r => r.businessId))];
        const buList = uniqueBuIds.map(id => businesses.find(b => b.id === id)).filter((b): b is typeof businesses[0] => !!b).sort((a, b) => a.name.localeCompare(b.name));
        return [{ value: 'all', label: 'All Business Units' }, ...buList.map(b => ({ value: b.id, label: b.name }))];
    }, [bodBRItems, businesses]);
    const filteredBodBRItems = React.useMemo(() => {
        if (bodBRBuFilter === 'all') return bodBRItems;
        return bodBRItems.filter(r => r.businessId === bodBRBuFilter);
    }, [bodBRItems, bodBRBuFilter]);


    const handlePreparePRFSubmit = (prfReq: Requisition, updatedOrigin?: Requisition) => {
        if (updatedOrigin) {
            onUpdateRequisition(updatedOrigin);
        }

        const exists = requisitions.some(r => r.id === prfReq.id);

        if (exists) {
            onUpdateRequisition({ ...prfReq, status: RequisitionStatus.PRF_PENDING_MANAGER });
        } else {
            onCreateRequisition(prfReq);
        }

        setPreparePRFReq(null);
    };

    const handleApprove = async (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();

        if (confirm(`Are you sure you want to approve ${req.id}?`)) {
            try {
                await RequisitionService.approveRequisition(
                    req.id,
                    currentUser.id,
                    currentUser.name
                );
                // Optimistic update or refresh logic would go here, 
                // but since we rely on parent props, we might need a refresh callback or wait for real-time update.
                // Assuming onUpdateRequisition handles local state update if passed the updated object, 
                // but RequisitionService.approveRequisition returns void/promise.
                // Ideally, we should fetch the updated req or construct it.
                // For now, let's assume the parent or a listener will update the list.
                // To be safe, we can manually trigger an update if we knew the next status.
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error("Error approving requisition:", error);
                alert(`Failed to approve requisition: ${message}`);
            }
        }
    };

    const handleRejectClick = (req: Requisition, e: React.MouseEvent) => {
        e.stopPropagation();
        setRejectingReq(req);
    };

    const handleRejectConfirm = async (reason: string) => {
        if (bulkRejectMode && selectedCheckAuthIds.size > 0) {
            // Bulk reject mode
            try {
                const idsToReject = Array.from(selectedCheckAuthIds);
                for (const id of idsToReject) {
                    await RequisitionService.rejectRequisition(
                        id,
                        currentUser.id,
                        currentUser.name,
                        reason
                    );
                }
                setSelectedCheckAuthIds(new Set());
                setBulkRejectMode(false);
                setRejectingReq(null);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error bulk rejecting requisitions:', error);
                alert(`Failed to reject requisitions: ${message}`);
            }
        } else if (rejectingReq) {
            try {
                await RequisitionService.rejectRequisition(
                    rejectingReq.id,
                    currentUser.id,
                    currentUser.name,
                    reason
                );
                setRejectingReq(null);
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error rejecting requisition:', error);
                alert(`Failed to reject requisition: ${message}`);
            }
        }
    };

    // Check Authorization Bulk Selection Handlers
    const toggleCheckAuthSelect = (id: string) => {
        setSelectedCheckAuthIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const selectAllCheckAuth = () => {
        if (selectedCheckAuthIds.size === filteredCheckAuthItems.length) {
            setSelectedCheckAuthIds(new Set());
        } else {
            setSelectedCheckAuthIds(new Set(filteredCheckAuthItems.map(r => r.id)));
        }
    };

    const handleBulkApprove = async () => {
        if (selectedCheckAuthIds.size === 0) return;

        if (confirm(`Are you sure you want to approve ${selectedCheckAuthIds.size} check authorization(s)?`)) {
            try {
                const idsToApprove = Array.from(selectedCheckAuthIds);
                for (const id of idsToApprove) {
                    await RequisitionService.approveRequisition(
                        id,
                        currentUser.id,
                        currentUser.name
                    );
                }
                setSelectedCheckAuthIds(new Set());
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                console.error('Error bulk approving requisitions:', error);
                alert(`Failed to approve requisitions: ${message}`);
            }
        }
    };

    const handleBulkReject = () => {
        if (selectedCheckAuthIds.size === 0) return;
        setBulkRejectMode(true);
        // Create a dummy requisition to trigger the rejection modal
        const firstSelectedId = Array.from(selectedCheckAuthIds)[0];
        const firstReq = filteredCheckAuthItems.find(r => r.id === firstSelectedId);
        if (firstReq) {
            setRejectingReq(firstReq);
        }
    };

    // ========== FINANCE HEAD BR BULK SELECTION HANDLERS ==========
    const toggleFinanceBRSelect = (id: string) => {
        setSelectedFinanceBRIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    const selectAllFinanceBR = () => {
        if (selectedFinanceBRIds.size === filteredFinanceBRItems.length) setSelectedFinanceBRIds(new Set());
        else setSelectedFinanceBRIds(new Set(filteredFinanceBRItems.map(r => r.id)));
    };
    const handleBulkApproveFinanceBR = async () => {
        if (selectedFinanceBRIds.size === 0) return;
        if (confirm(`Approve ${selectedFinanceBRIds.size} Finance Head BR item(s)?`)) {
            try {
                for (const id of Array.from(selectedFinanceBRIds)) {
                    await RequisitionService.approveRequisition(id, currentUser.id, currentUser.name);
                }
                setSelectedFinanceBRIds(new Set());
            } catch (error: unknown) {
                alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    // ========== GM BR BULK SELECTION HANDLERS ==========
    const toggleGmBRSelect = (id: string) => {
        setSelectedGmBRIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    const selectAllGmBR = () => {
        if (selectedGmBRIds.size === filteredGmBRItems.length) setSelectedGmBRIds(new Set());
        else setSelectedGmBRIds(new Set(filteredGmBRItems.map(r => r.id)));
    };
    const handleBulkApproveGmBR = async () => {
        if (selectedGmBRIds.size === 0) return;
        if (confirm(`Approve ${selectedGmBRIds.size} GM BR item(s)?`)) {
            try {
                for (const id of Array.from(selectedGmBRIds)) {
                    await RequisitionService.approveRequisition(id, currentUser.id, currentUser.name);
                }
                setSelectedGmBRIds(new Set());
            } catch (error: unknown) {
                alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    // ========== BOD BR BULK SELECTION HANDLERS ==========
    const toggleBodBRSelect = (id: string) => {
        setSelectedBodBRIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    const selectAllBodBR = () => {
        if (selectedBodBRIds.size === filteredBodBRItems.length) setSelectedBodBRIds(new Set());
        else setSelectedBodBRIds(new Set(filteredBodBRItems.map(r => r.id)));
    };
    const handleBulkApproveBodBR = async () => {
        if (selectedBodBRIds.size === 0) return;
        if (confirm(`Approve ${selectedBodBRIds.size} BOD BR item(s)?`)) {
            try {
                for (const id of Array.from(selectedBodBRIds)) {
                    await RequisitionService.approveRequisition(id, currentUser.id, currentUser.name);
                }
                setSelectedBodBRIds(new Set());
            } catch (error: unknown) {
                alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    // ========== BULK REJECT HANDLERS (matching Check Auth pattern) ==========

    const handleBulkRejectFinanceBR = () => {
        if (selectedFinanceBRIds.size === 0) return;
        setRejectingReq(filteredFinanceBRItems.find(r => selectedFinanceBRIds.has(r.id)) || null);
    };
    const handleBulkRejectGmBR = () => {
        if (selectedGmBRIds.size === 0) return;
        setRejectingReq(filteredGmBRItems.find(r => selectedGmBRIds.has(r.id)) || null);
    };
    const handleBulkRejectBodBR = () => {
        if (selectedBodBRIds.size === 0) return;
        setRejectingReq(filteredBodBRItems.find(r => selectedBodBRIds.has(r.id)) || null);
    };
    const handleBulkRejectPending = () => {
        if (selectedPendingApprovalIds.size === 0) return;
        const items = getActiveTabItems();
        setRejectingReq(items.find(a => selectedPendingApprovalIds.has(a.id))?.rawRequisition || null);
    };


    // ========== PENDING APPROVALS BULK SELECTION HANDLERS ==========
    const togglePendingApprovalSelect = (id: string) => {
        setSelectedPendingApprovalIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };
    const selectAllPendingApprovals = () => {
        const items = getActiveTabItems();
        if (selectedPendingApprovalIds.size === items.length) setSelectedPendingApprovalIds(new Set());
        else setSelectedPendingApprovalIds(new Set(items.map(r => r.id)));
    };
    const handleBulkApprovePendingApprovals = async () => {
        if (selectedPendingApprovalIds.size === 0) return;
        if (confirm(`Approve ${selectedPendingApprovalIds.size} item(s)?`)) {
            try {
                for (const id of Array.from(selectedPendingApprovalIds)) {
                    await RequisitionService.approveRequisition(id, currentUser.id, currentUser.name);
                }
                setSelectedPendingApprovalIds(new Set());
            } catch (error: unknown) {
                alert(`Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
    };

    return (
        <div className="space-y-8 text-slate-800 dark:text-white min-h-screen">
            {/* Welcome Section */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold">Dashboard Overview</h1>
                    <p className="text-slate-500 dark:text-slate-300">Welcome back, {currentUser.name}! Here's what's happening today.</p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{currentUser.role.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col-reverse lg:flex-row lg:items-start gap-6 lg:gap-8">
                {/* Main Content Area */}
                <div className="flex-1 space-y-8 w-full">
                    {/* Stats Grid - Role-Specific Approval Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                        {/* BURF Manager Approval Card */}
                        {hasPermission('approval:manager:burf') && (
                            <DashboardCard
                                id="burf-manager"
                                label="BURF Mgr"
                                value={burfApprovals.length.toString()}
                                route="/procurement-approvals?tab=burf"
                                icon={Clock}
                                progress={Math.min(burfApprovals.length * 15, 100)}
                                sparklineData={[2, 4, 3, 5, 4, burfApprovals.length]}
                                gradientColors={['#f97316', '#eab308']}
                                iconColor="text-orange-400"
                                sparklineColor="#f97316"
                                urgency={burfApprovals.length > 3 ? 'critical' : burfApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* CIC Review Card */}
                        {hasPermission('approval:cic:burf') && (
                            <DashboardCard
                                id="cic-review"
                                label="CIC Review"
                                value={cicReviews.length.toString()}
                                route="/procurement-approvals?tab=cic"
                                icon={ShieldCheck}
                                progress={Math.min(cicReviews.length * 15, 100)}
                                sparklineData={[1, 2, 1, 3, 2, cicReviews.length]}
                                gradientColors={['#06b6d4', '#0891b2']}
                                iconColor="text-cyan-400"
                                sparklineColor="#06b6d4"
                                urgency={cicReviews.length > 2 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* PRF Manager Approval Card */}
                        {hasPermission('approval:manager:prf') && (
                            <DashboardCard
                                id="prf-manager"
                                label="PRF Mgr"
                                value={prfApprovals.length.toString()}
                                route="/procurement-approvals?tab=prf"
                                icon={FileText}
                                progress={Math.min(prfApprovals.length * 15, 100)}
                                sparklineData={[2, 3, 2, 4, 3, prfApprovals.length]}
                                gradientColors={['#a855f7', '#8b5cf6']}
                                iconColor="text-purple-400"
                                sparklineColor="#a855f7"
                                urgency={prfApprovals.length > 3 ? 'critical' : prfApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* GM PRF Approval Card - Only for assigned GM */}
                        {currentUser.id === approverAssignments.gmUid && gmPrfApprovals.length > 0 && (
                            <DashboardCard
                                id="gm-prf"
                                label="GM PRF"
                                value={gmPrfApprovals.length.toString()}
                                route="/procurement-approvals?tab=gmprf"
                                icon={Users}
                                progress={Math.min(gmPrfApprovals.length * 20, 100)}
                                sparklineData={[1, 2, 1, 2, 1, gmPrfApprovals.length]}
                                gradientColors={['#6366f1', '#4f46e5']}
                                iconColor="text-indigo-400"
                                sparklineColor="#6366f1"
                                urgency={gmPrfApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Finance Head BR Card - Only for assigned Finance Heads */}
                        {approverAssignments.financeHeads?.some(fh => fh.userId === currentUser.id) && brApprovals.length > 0 && (
                            <DashboardCard
                                id="finance-br"
                                label="Finance BR"
                                value={brApprovals.length.toString()}
                                route="/finance?tab=br_pending"
                                icon={Receipt}
                                progress={Math.min(brApprovals.length * 20, 100)}
                                sparklineData={[1, 1, 2, 1, 2, brApprovals.length]}
                                gradientColors={['#22c55e', '#16a34a']}
                                iconColor="text-emerald-400"
                                sparklineColor="#22c55e"
                                urgency={brApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* BOD Approval Card */}
                        {(hasPermission('approval:bod') || approverAssignments.bodApprovers?.some(b => b.userId === currentUser.id)) && checkAuthApprovals.length > 0 && (
                            <DashboardCard
                                id="bod-approval"
                                label="BOD Auth"
                                value={checkAuthApprovals.length.toString()}
                                route="/finance?tab=check_pending"
                                icon={ShieldCheck}
                                progress={Math.min(checkAuthApprovals.length * 20, 100)}
                                sparklineData={[0, 1, 0, 1, 1, checkAuthApprovals.length]}
                                gradientColors={['#f59e0b', '#d97706']}
                                iconColor="text-amber-400"
                                sparklineColor="#f59e0b"
                                urgency={checkAuthApprovals.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Fund Release Card */}
                        {hasPermission('finance:release_funds') && pendingFundReleaseItems.length > 0 && (
                            <DashboardCard
                                id="fund-release"
                                label="Fund Release"
                                value={pendingFundReleaseItems.length.toString()}
                                route="/finance?tab=prf_pending"
                                icon={Wallet}
                                progress={Math.min(pendingFundReleaseItems.length * 15, 100)}
                                sparklineData={[2, 3, 2, 4, 3, pendingFundReleaseItems.length]}
                                gradientColors={['#10b981', '#059669']}
                                iconColor="text-emerald-400"
                                sparklineColor="#10b981"
                                urgency={pendingFundReleaseItems.length > 3 ? 'critical' : pendingFundReleaseItems.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Overdue Items Card */}
                        {hasPermission('dashboard:widget:overdue_items') && (
                            <DashboardCard
                                id="overdue-items"
                                label="Overdue"
                                value={overdueCount.toString()}
                                route="/procurement-approvals"
                                icon={AlertTriangle}
                                progress={Math.min(overdueCount * 15, 100)}
                                sparklineData={[2, 4, 3, 5, 4, overdueCount]}
                                gradientColors={overdueCount > 0 ? ['#ef4444', '#f97316'] : ['#64748b', '#475569']}
                                iconColor={overdueCount > 0 ? 'text-red-400' : 'text-slate-400'}
                                sparklineColor={overdueCount > 0 ? '#ef4444' : '#64748b'}
                                urgency={overdueCount > 3 ? 'critical' : overdueCount > 0 ? 'warning' : 'normal'}
                                previewItems={overdueItems.slice(0, 3).map(r => ({
                                    id: r.id,
                                    title: r.id,
                                    subtitle: `Due: ${new Date(r.dateNeeded!).toLocaleDateString()}`
                                }))}
                            />
                        )}

                        {/* PCF Approval Card - Connected to real data */}
                        {hasPermission('pcf:approve') && (
                            <DashboardCard
                                id="pcf-approval"
                                label="PCF Approval"
                                value={pcfPendingCount.toString()}
                                route="/pcf-approvals"
                                icon={Wallet}
                                progress={Math.min(pcfPendingCount * 20, 100)}
                                sparklineData={[1, 2, 1, 3, 2, pcfPendingCount]}
                                gradientColors={pcfPendingCount > 0 ? ['#f97316', '#eab308'] : ['#64748b', '#475569']}
                                iconColor={pcfPendingCount > 0 ? 'text-orange-400' : 'text-slate-400'}
                                sparklineColor={pcfPendingCount > 0 ? '#f97316' : '#64748b'}
                                urgency={pcfPendingCount > 3 ? 'critical' : pcfPendingCount > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* CFO Approval Card - Only for assigned CFO */}
                        {currentUser.id === approverAssignments.cfoUid && cfoPendingItems.length > 0 && (
                            <DashboardCard
                                id="cfo-approval"
                                label="CFO Approval"
                                value={cfoPendingItems.length.toString()}
                                route="/finance?tab=br_pending"
                                icon={Briefcase}
                                progress={Math.min(cfoPendingItems.length * 20, 100)}
                                sparklineData={[1, 1, 2, 1, 2, cfoPendingItems.length]}
                                gradientColors={['#8b5cf6', '#a855f7']}
                                iconColor="text-purple-400"
                                sparklineColor="#8b5cf6"
                                urgency={cfoPendingItems.length > 0 ? 'warning' : 'normal'}
                            />
                        )}

                        {/* Ready for PRF Card */}
                        {hasPermission('dashboard:widget:ready_for_prf') && (
                            <DashboardCard
                                id="ready-for-prf"
                                label="Ready for PRF"
                                value={forPrfCount.toString()}
                                route="/prf"
                                icon={FileText}
                                progress={Math.min(forPrfCount * 20, 100)}
                                sparklineData={[2, 4, 6, 3, 5, forPrfCount]}
                                gradientColors={['#eab308', '#22c55e']}
                                iconColor="text-yellow-400"
                                sparklineColor="#eab308"
                                trendPercent={forPrfCount > 0 ? 8 : 0}
                                trend={forPrfCount > 2 ? 'up' : 'neutral'}
                            />
                        )}

                        {/* Avg Processing Time Card */}
                        {hasPermission('dashboard:widget:avg_processing') && (
                            <DashboardCard
                                id="avg-processing"
                                label="Avg Days"
                                value={avgProcessingDays.toString()}
                                route="/finance"
                                icon={Timer}
                                progress={Math.min(100 - avgProcessingDays * 5, 100)}
                                sparklineData={[12, 10, 8, 9, 7, avgProcessingDays]}
                                gradientColors={avgProcessingDays < 7 ? ['#22c55e', '#10b981'] : ['#eab308', '#f97316']}
                                iconColor={avgProcessingDays < 7 ? 'text-emerald-400' : 'text-yellow-400'}
                                sparklineColor={avgProcessingDays < 7 ? '#22c55e' : '#eab308'}
                                trendPercent={avgProcessingDays > 0 ? -5 : 0}
                                trend={avgProcessingDays < 7 ? 'down' : 'up'}
                            />
                        )}

                        {/* Completed This Month Card */}
                        {hasPermission('dashboard:widget:completed_month') && (
                            <DashboardCard
                                id="completed-month"
                                label="Completed"
                                value={completedThisMonth.toString()}
                                route="/finance"
                                icon={CheckCircle2}
                                progress={Math.min(completedThisMonth * 10, 100)}
                                sparklineData={[3, 5, 4, 6, completedLastMonth, completedThisMonth]}
                                gradientColors={['#22c55e', '#10b981']}
                                iconColor="text-emerald-400"
                                sparklineColor="#22c55e"
                                trendPercent={Math.abs(monthlyTrendPercent)}
                                trend={monthlyTrendPercent > 0 ? 'up' : monthlyTrendPercent < 0 ? 'down' : 'neutral'}
                            />
                        )}

                        {/* Total Spend Card with Business Filter */}
                        {hasPermission('dashboard:widget:total_spend') && (
                            <DashboardCard
                                id="total-spend"
                                label="Spend"
                                value={`₱${(totalSpend / 1000).toFixed(0)}k`}
                                route="/finance"
                                icon={Coins}
                                progress={85}
                                sparklineData={[20, 35, 45, 60, 75, 85]}
                                gradientColors={['#22c55e', '#10b981']}
                                iconColor="text-emerald-400"
                                sparklineColor="#22c55e"
                                trendPercent={12}
                                trend="up"
                                filterOptions={businessFilterOptions}
                                selectedFilter={selectedBU}
                                onFilterChange={setSelectedBU}
                            />
                        )}

                        {/* Top Requesters Card */}
                        {hasPermission('dashboard:widget:top_requesters') && (
                            <DashboardCard
                                id="top-requesters"
                                label="Top Requester"
                                value={top5Requesters[0]?.count.toString() || '0'}
                                route="/settings"
                                icon={Users}
                                progress={top5Requesters.length > 0 ? 100 : 0}
                                sparklineData={top5Requesters.slice(0, 6).map(r => r.count)}
                                gradientColors={['#8b5cf6', '#a855f7']}
                                iconColor="text-purple-400"
                                sparklineColor="#8b5cf6"
                                breakdown={top5Requesters.map(r => ({
                                    label: r.name.split(' ')[0],
                                    count: r.count,
                                    color: 'text-purple-400'
                                }))}
                                previewItems={top5Requesters.slice(0, 3).map(r => ({
                                    id: r.id,
                                    title: r.name,
                                    subtitle: `${r.count} requests`
                                }))}
                            />
                        )}
                    </div>


                    {/* === BUDGET REVIEW SECTION === */}
                    {(hasPermission('dashboard:section:finance_head_br') && financeHeadBRItems.length > 0) ||
                        (hasPermission('dashboard:section:gm_br') && gmBRItems.length > 0) ||
                        (hasPermission('dashboard:section:bod_br') && bodBRItems.length > 0) ? (
                        <div className="mb-6">
                            <h2 className="text-base font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <FileText size={16} />
                                Budget Review Queue
                            </h2>
                            <div className="space-y-6">
                                {/* Finance Head BR Widget - Enhanced with Bulk Selection */}
                                {hasPermission('dashboard:section:finance_head_br') && financeHeadBRItems.length > 0 && (
                                    <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-indigo-200/60 dark:border-indigo-500/30 shadow-[0_8px_30px_-6px_rgba(139,92,246,0.15)] dark:shadow-none flex flex-col min-h-[420px]">
                                        <div className="p-5 flex flex-col gap-3 border-b border-indigo-100 dark:border-slate-700/50">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                    <FileText className="text-indigo-600 dark:text-indigo-400" size={20} />
                                                    Finance Head BR
                                                </h3>
                                                <span className="text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-full border border-indigo-200 dark:border-indigo-500/20">
                                                    {filteredFinanceBRItems.length} Pending
                                                </span>
                                            </div>
                                            {/* BU Filter & Bulk Actions */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {financeBRBuOptions.length > 2 && (
                                                    <select
                                                        value={financeBRBuFilter}
                                                        onChange={(e) => { setFinanceBRBuFilter(e.target.value); setSelectedFinanceBRIds(new Set()); }}
                                                        className="text-sm px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-500/30 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                                    >
                                                        {financeBRBuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                )}
                                                <button onClick={selectAllFinanceBR} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                                    {selectedFinanceBRIds.size === filteredFinanceBRItems.length && filteredFinanceBRItems.length > 0 ? <CheckSquare size={16} className="text-indigo-500" /> : <Square size={16} />}
                                                    {selectedFinanceBRIds.size === filteredFinanceBRItems.length && filteredFinanceBRItems.length > 0 ? 'Deselect All' : `Select All (${filteredFinanceBRItems.length})`}
                                                </button>
                                                <button
                                                    onClick={handleBulkApproveFinanceBR}
                                                    disabled={selectedFinanceBRIds.size === 0}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedFinanceBRIds.size > 0
                                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <CheckCircle size={16} /> Approve {selectedFinanceBRIds.size > 0 && `(${selectedFinanceBRIds.size})`}
                                                </button>
                                                <button
                                                    onClick={handleBulkRejectFinanceBR}
                                                    disabled={selectedFinanceBRIds.size === 0}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedFinanceBRIds.size > 0
                                                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <XCircle size={16} /> Reject {selectedFinanceBRIds.size > 0 && `(${selectedFinanceBRIds.size})`}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {filteredFinanceBRItems.map(req => {
                                                    const requester = allUsers.find(u => u.id === req.requesterId);
                                                    const business = businesses.find(b => b.id === req.businessId);
                                                    const isSelected = selectedFinanceBRIds.has(req.id);
                                                    return (
                                                        <div
                                                            key={req.id}
                                                            className={`p-3 rounded-xl border-2 transition-all cursor-pointer group ${isSelected
                                                                ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-500 shadow-md'
                                                                : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md'}`}
                                                        >
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <button onClick={(e) => { e.stopPropagation(); toggleFinanceBRSelect(req.id); }} className="mt-0.5 flex-shrink-0">
                                                                    {isSelected ? <CheckSquare size={16} className="text-indigo-500" /> : <Square size={16} className="text-slate-400" />}
                                                                </button>
                                                                <div className="flex-1 min-w-0" onClick={() => setDrawerReq(req)}>
                                                                    <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-1 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/10">{req.id}</span>
                                                                    <h4 className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate mt-1">{req.description}</h4>
                                                                </div>
                                                                <span className="text-xs text-slate-500 flex-shrink-0">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs mb-1 ml-6">
                                                                <span className="text-slate-600 dark:text-slate-400">{requester?.name || 'Unknown'}</span>
                                                                <span className="text-slate-700 dark:text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs mb-3 ml-6">
                                                                <span className="font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/10 text-[10px]">{business?.name || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50 ml-6">
                                                                <button onClick={(e) => handleApprove(req, e)} className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-green-600/20 text-emerald-600 dark:text-green-400 hover:bg-emerald-100 dark:hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                                                    <CheckCircle size={14} /> Approve
                                                                </button>
                                                                <button onClick={(e) => handleRejectClick(req, e)} className="flex-1 py-1.5 px-3 rounded-lg bg-rose-50 dark:bg-red-600/20 text-rose-600 dark:text-red-400 hover:bg-rose-100 dark:hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                                                    <XCircle size={14} /> Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* GM Budget Review Widget - Enhanced with Bulk Selection */}
                                {hasPermission('dashboard:section:gm_br') && gmBRItems.length > 0 && (
                                    <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-violet-200/60 dark:border-violet-500/30 shadow-[0_8px_30px_-6px_rgba(139,92,246,0.15)] dark:shadow-none flex flex-col min-h-[420px]">
                                        <div className="p-5 flex flex-col gap-3 border-b border-violet-100 dark:border-slate-700/50">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                    <FileText className="text-violet-600 dark:text-violet-400" size={20} />
                                                    GM Budget Review
                                                </h3>
                                                <span className="text-xs font-medium bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 px-2 py-1 rounded-full border border-violet-200 dark:border-violet-500/20">
                                                    {filteredGmBRItems.length} Pending
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {gmBRBuOptions.length > 2 && (
                                                    <select value={gmBRBuFilter} onChange={(e) => { setGmBRBuFilter(e.target.value); setSelectedGmBRIds(new Set()); }} className="text-sm px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400">
                                                        {gmBRBuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                )}
                                                <button onClick={selectAllGmBR} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                                    {selectedGmBRIds.size === filteredGmBRItems.length && filteredGmBRItems.length > 0 ? <CheckSquare size={16} className="text-violet-500" /> : <Square size={16} />}
                                                    {selectedGmBRIds.size === filteredGmBRItems.length && filteredGmBRItems.length > 0 ? 'Deselect All' : `Select All (${filteredGmBRItems.length})`}
                                                </button>
                                                <button
                                                    onClick={handleBulkApproveGmBR}
                                                    disabled={selectedGmBRIds.size === 0}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedGmBRIds.size > 0
                                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <CheckCircle size={16} /> Approve {selectedGmBRIds.size > 0 && `(${selectedGmBRIds.size})`}
                                                </button>
                                                <button
                                                    onClick={handleBulkRejectGmBR}
                                                    disabled={selectedGmBRIds.size === 0}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedGmBRIds.size > 0
                                                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <XCircle size={16} /> Reject {selectedGmBRIds.size > 0 && `(${selectedGmBRIds.size})`}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {filteredGmBRItems.map(req => {
                                                    const requester = allUsers.find(u => u.id === req.requesterId);
                                                    const business = businesses.find(b => b.id === req.businessId);
                                                    const isSelected = selectedGmBRIds.has(req.id);
                                                    return (
                                                        <div key={req.id} className={`p-3 rounded-xl border-2 transition-all cursor-pointer group ${isSelected
                                                            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-400 dark:border-violet-500 shadow-md'
                                                            : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700/50 hover:border-violet-300 dark:hover:border-violet-500/50 hover:shadow-md'}`}>
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <button onClick={(e) => { e.stopPropagation(); toggleGmBRSelect(req.id); }} className="mt-0.5 flex-shrink-0">
                                                                    {isSelected ? <CheckSquare size={16} className="text-violet-500" /> : <Square size={16} className="text-slate-400" />}
                                                                </button>
                                                                <div className="flex-1 min-w-0" onClick={() => setDrawerReq(req)}>
                                                                    <span className="text-xs font-mono text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20 px-1 py-0.5 rounded border border-violet-100 dark:border-violet-500/10">{req.id}</span>
                                                                    <h4 className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate mt-1">{req.description}</h4>
                                                                </div>
                                                                <span className="text-xs text-slate-500 flex-shrink-0">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs mb-1 ml-6">
                                                                <span className="text-slate-600">{requester?.name || 'Unknown'}</span>
                                                                <span className="text-slate-700 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs mb-3 ml-6">
                                                                <span className="font-semibold px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-500/10 text-[10px]">{business?.name || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50 ml-6">
                                                                <button onClick={(e) => handleApprove(req, e)} className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-green-600/20 text-emerald-600 dark:text-green-400 hover:bg-emerald-100 dark:hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                                                    <CheckCircle size={14} /> Approve
                                                                </button>
                                                                <button onClick={(e) => handleRejectClick(req, e)} className="flex-1 py-1.5 px-3 rounded-lg bg-rose-50 dark:bg-red-600/20 text-rose-600 dark:text-red-400 hover:bg-rose-100 dark:hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                                                    <XCircle size={14} /> Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* BOD Budget Review Widget - Enhanced with Bulk Selection */}
                                {hasPermission('dashboard:section:bod_br') && bodBRItems.length > 0 && (
                                    <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-rose-200/60 dark:border-rose-500/30 shadow-[0_8px_30px_-6px_rgba(244,63,94,0.15)] dark:shadow-none flex flex-col min-h-[420px]">
                                        <div className="p-5 flex flex-col gap-3 border-b border-rose-100 dark:border-slate-700/50">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                                    <FileText className="text-rose-500 dark:text-rose-400" size={20} />
                                                    BOD Budget Review
                                                </h3>
                                                <span className="text-xs font-medium bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-full border border-rose-200 dark:border-rose-500/20">
                                                    {filteredBodBRItems.length} Pending
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3 flex-wrap">
                                                {bodBRBuOptions.length > 2 && (
                                                    <select value={bodBRBuFilter} onChange={(e) => { setBodBRBuFilter(e.target.value); setSelectedBodBRIds(new Set()); }} className="text-sm px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400">
                                                        {bodBRBuOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                )}
                                                <button onClick={selectAllBodBR} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
                                                    {selectedBodBRIds.size === filteredBodBRItems.length && filteredBodBRItems.length > 0 ? <CheckSquare size={16} className="text-rose-500" /> : <Square size={16} />}
                                                    {selectedBodBRIds.size === filteredBodBRItems.length && filteredBodBRItems.length > 0 ? 'Deselect All' : `Select All (${filteredBodBRItems.length})`}
                                                </button>
                                                <button
                                                    onClick={handleBulkApproveBodBR}
                                                    disabled={selectedBodBRIds.size === 0}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedBodBRIds.size > 0
                                                        ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <CheckCircle size={16} /> Approve {selectedBodBRIds.size > 0 && `(${selectedBodBRIds.size})`}
                                                </button>
                                                <button
                                                    onClick={handleBulkRejectBodBR}
                                                    disabled={selectedBodBRIds.size === 0}
                                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedBodBRIds.size > 0
                                                        ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md'
                                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                                >
                                                    <XCircle size={16} /> Reject {selectedBodBRIds.size > 0 && `(${selectedBodBRIds.size})`}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                {filteredBodBRItems.map(req => {
                                                    const requester = allUsers.find(u => u.id === req.requesterId);
                                                    const business = businesses.find(b => b.id === req.businessId);
                                                    const isSelected = selectedBodBRIds.has(req.id);
                                                    return (
                                                        <div key={req.id} className={`p-3 rounded-xl border-2 transition-all cursor-pointer group ${isSelected
                                                            ? 'bg-rose-50 dark:bg-rose-900/20 border-rose-400 dark:border-rose-500 shadow-md'
                                                            : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700/50 hover:border-rose-300 dark:hover:border-rose-500/50 hover:shadow-md'}`}>
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <button onClick={(e) => { e.stopPropagation(); toggleBodBRSelect(req.id); }} className="mt-0.5 flex-shrink-0">
                                                                    {isSelected ? <CheckSquare size={16} className="text-rose-500" /> : <Square size={16} className="text-slate-400" />}
                                                                </button>
                                                                <div className="flex-1 min-w-0" onClick={() => setDrawerReq(req)}>
                                                                    <span className="text-xs font-mono text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-1 py-0.5 rounded border border-rose-100 dark:border-rose-500/10">{req.id}</span>
                                                                    <h4 className="font-medium text-slate-700 dark:text-slate-200 text-sm truncate mt-1">{req.description}</h4>
                                                                </div>
                                                                <span className="text-xs text-slate-500 flex-shrink-0">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs mb-1 ml-6">
                                                                <span className="text-slate-600">{requester?.name || 'Unknown'}</span>
                                                                <span className="text-slate-700 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs mb-3 ml-6">
                                                                <span className="font-semibold px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/10 text-[10px]">{business?.name || 'N/A'}</span>
                                                            </div>
                                                            <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50 ml-6">
                                                                <button onClick={(e) => handleApprove(req, e)} className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-green-600/20 text-emerald-600 dark:text-green-400 hover:bg-emerald-100 dark:hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                                                    <CheckCircle size={14} /> Approve
                                                                </button>
                                                                <button onClick={(e) => handleRejectClick(req, e)} className="flex-1 py-1.5 px-3 rounded-lg bg-rose-50 dark:bg-red-600/20 text-rose-600 dark:text-red-400 hover:bg-rose-100 dark:hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                                                                    <XCircle size={14} /> Reject
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : null}

                    {/* === CHECK AUTHORIZATION SECTION - ENHANCED === */}
                    {hasPermission('dashboard:section:check_auth') && checkAuthItems.length > 0 && (
                        <div className="mb-6">
                            <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <ShieldCheck size={14} />
                                Check Authorization Queue
                            </h2>
                            {/* Full-width container */}
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-amber-200/60 dark:border-amber-500/30 shadow-[0_8px_30px_-6px_rgba(245,158,11,0.15)] dark:shadow-none">
                                {/* Header with count and bulk actions */}
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-amber-100 dark:border-slate-700/50">
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            <ShieldCheck className="text-amber-500 dark:text-amber-400" size={22} />
                                            Check Authorization
                                        </h3>
                                        <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-500/20">
                                            {filteredCheckAuthItems.length} Pending
                                        </span>
                                        {/* Business Unit Filter - only show if multiple BUs */}
                                        {checkAuthBuOptions.length > 2 && (
                                            <select
                                                value={checkAuthBuFilter}
                                                onChange={(e) => {
                                                    setCheckAuthBuFilter(e.target.value);
                                                    setSelectedCheckAuthIds(new Set()); // Clear selection on filter change
                                                }}
                                                className="text-sm px-3 py-1.5 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                            >
                                                {checkAuthBuOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>

                                    {/* Bulk action bar */}
                                    <div className="flex items-center gap-3 flex-wrap">
                                        {/* Select All Toggle */}
                                        <button
                                            onClick={selectAllCheckAuth}
                                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                                        >
                                            {selectedCheckAuthIds.size === filteredCheckAuthItems.length && filteredCheckAuthItems.length > 0 ? (
                                                <CheckSquare size={16} className="text-amber-500" />
                                            ) : (
                                                <Square size={16} />
                                            )}
                                            {selectedCheckAuthIds.size === filteredCheckAuthItems.length && filteredCheckAuthItems.length > 0
                                                ? 'Deselect All'
                                                : `Select All (${filteredCheckAuthItems.length})`}
                                        </button>

                                        {/* Bulk Approve */}
                                        <button
                                            onClick={handleBulkApprove}
                                            disabled={selectedCheckAuthIds.size === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCheckAuthIds.size > 0
                                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md hover:shadow-lg'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                }`}
                                        >
                                            <CheckCircle size={16} />
                                            Approve Selected {selectedCheckAuthIds.size > 0 && `(${selectedCheckAuthIds.size})`}
                                        </button>

                                        {/* Bulk Reject */}
                                        <button
                                            onClick={handleBulkReject}
                                            disabled={selectedCheckAuthIds.size === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedCheckAuthIds.size > 0
                                                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md hover:shadow-lg'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                }`}
                                        >
                                            <XCircle size={16} />
                                            Reject Selected {selectedCheckAuthIds.size > 0 && `(${selectedCheckAuthIds.size})`}
                                        </button>
                                    </div>
                                </div>

                                {/* Items Grid - wider layout */}
                                <div className="p-5 overflow-y-auto max-h-[600px]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {filteredCheckAuthItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            const business = businesses.find(b => b.id === req.businessId);
                                            const isSelected = selectedCheckAuthIds.has(req.id);

                                            return (
                                                <div
                                                    key={req.id}
                                                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer group ${isSelected
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-400 dark:border-amber-500 shadow-md'
                                                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-600/50 hover:shadow-md'
                                                        }`}
                                                >
                                                    {/* Checkbox + Header Row */}
                                                    <div className="flex items-start gap-3 mb-3">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleCheckAuthSelect(req.id);
                                                            }}
                                                            className="mt-0.5 flex-shrink-0"
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare size={20} className="text-amber-500" />
                                                            ) : (
                                                                <Square size={20} className="text-slate-400 hover:text-amber-500 transition-colors" />
                                                            )}
                                                        </button>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/10">
                                                                    {req.id}
                                                                </span>
                                                                <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                            </div>
                                                            <h4
                                                                onClick={() => setDrawerReq(req)}
                                                                className="font-semibold text-slate-700 dark:text-slate-200 truncate hover:text-amber-600 dark:hover:text-amber-300 transition-colors cursor-pointer"
                                                            >
                                                                {req.description}
                                                            </h4>
                                                        </div>
                                                    </div>

                                                    {/* Details */}
                                                    <div className="pl-8 space-y-2">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-slate-600 dark:text-slate-400">{requester?.name || 'Unknown'}</span>
                                                            <span className="font-bold text-slate-800 dark:text-white">₱{req.totalAmount?.toLocaleString()}</span>
                                                        </div>
                                                        {req.prfDetails?.supplier?.name && (
                                                            <div className="flex items-center text-xs">
                                                                <span className="text-slate-500">Supplier:</span>
                                                                <span className="text-slate-600 dark:text-slate-300 ml-1 truncate" title={req.prfDetails.supplier.name}>
                                                                    {req.prfDetails.supplier.name}
                                                                </span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20">
                                                                {business?.name || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Individual Actions */}
                                                    <div className="flex gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleApprove(req, e);
                                                            }}
                                                            className="flex-1 py-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                                                        >
                                                            <CheckCircle size={14} /> Authorize
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleRejectClick(req, e);
                                                            }}
                                                            className="flex-1 py-2 px-3 rounded-lg bg-rose-50 dark:bg-rose-600/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-600/30 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                                                        >
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-8 max-w-[1920px] mx-auto">
                        {/* Pending Approvals - Only visible with permission */}
                        {hasPermission('dashboard:section:pending_list') && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-purple-200/60 dark:border-purple-500/30 shadow-[0_8px_30px_-6px_rgba(139,92,246,0.1)] dark:shadow-none flex flex-col">
                                {/* Header with View All */}
                                <div className="p-6 flex justify-between items-center border-b border-purple-100 dark:border-slate-700/50">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Clock className="text-purple-600 dark:text-purple-400" size={20} />
                                        Pending Approvals
                                    </h3>
                                    <button onClick={() => navigate('/procurement-approvals')} className="text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-full text-slate-600 dark:text-white transition-colors">View All</button>
                                </div>

                                {/* Secondary Tab Bar - Filtered by Permission */}
                                <div className="px-6 pt-4 pb-2 flex gap-2 border-b border-purple-50 dark:border-slate-700/30 flex-wrap">
                                    {hasPermission('approval:manager:burf') && (
                                        <button
                                            onClick={() => { setPendingApprovalTab('burf'); setSelectedPendingApprovalIds(new Set()); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'burf'
                                                ? 'bg-orange-50 dark:bg-orange-600/20 text-orange-600 dark:text-orange-300 border border-orange-200 dark:border-orange-500/30'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            BURF
                                            {burfApprovals.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'burf' ? 'bg-orange-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                    {burfApprovals.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    {hasPermission('approval:cic:burf') && (
                                        <button
                                            onClick={() => { setPendingApprovalTab('cic'); setSelectedPendingApprovalIds(new Set()); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'cic'
                                                ? 'bg-cyan-50 dark:bg-cyan-600/20 text-cyan-600 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            CIC
                                            {cicReviews.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'cic' ? 'bg-cyan-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                    {cicReviews.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    {/* Show PRF tab if user has permission OR is a designated approver for any Direct PRF */}
                                    {(hasPermission('approval:manager:prf') || prfApprovals.length > 0) && (
                                        <button
                                            onClick={() => { setPendingApprovalTab('prf'); setSelectedPendingApprovalIds(new Set()); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'prf'
                                                ? 'bg-purple-50 dark:bg-purple-600/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            PRF
                                            {prfApprovals.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'prf' ? 'bg-purple-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                    {prfApprovals.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    {currentUser.id === approverAssignments.gmUid && (
                                        <button
                                            onClick={() => { setPendingApprovalTab('gmprf'); setSelectedPendingApprovalIds(new Set()); }}
                                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${pendingApprovalTab === 'gmprf'
                                                ? 'bg-indigo-50 dark:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/50'
                                                }`}
                                        >
                                            GM PRF
                                            {gmPrfApprovals.length > 0 && (
                                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${pendingApprovalTab === 'gmprf' ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300'
                                                    }`}>
                                                    {gmPrfApprovals.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Bulk Selection Controls */}
                                {getActiveTabItems().length > 0 && (
                                    <div className="px-6 py-3 flex items-center gap-3 flex-wrap bg-slate-50/50 dark:bg-slate-700/20 border-b border-purple-50 dark:border-slate-700/30">
                                        <button onClick={selectAllPendingApprovals} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600 shadow-sm text-slate-700 dark:text-slate-300 transition-colors">
                                            {selectedPendingApprovalIds.size === getActiveTabItems().length && getActiveTabItems().length > 0 ? <CheckSquare size={16} className="text-purple-500" /> : <Square size={16} />}
                                            {selectedPendingApprovalIds.size === getActiveTabItems().length && getActiveTabItems().length > 0 ? 'Deselect All' : `Select All (${getActiveTabItems().length})`}
                                        </button>
                                        <button
                                            onClick={handleBulkApprovePendingApprovals}
                                            disabled={selectedPendingApprovalIds.size === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedPendingApprovalIds.size > 0
                                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                        >
                                            <CheckCircle size={16} /> Approve {selectedPendingApprovalIds.size > 0 && `(${selectedPendingApprovalIds.size})`}
                                        </button>
                                        <button
                                            onClick={handleBulkRejectPending}
                                            disabled={selectedPendingApprovalIds.size === 0}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedPendingApprovalIds.size > 0
                                                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-md'
                                                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'}`}
                                        >
                                            <XCircle size={16} /> Reject {selectedPendingApprovalIds.size > 0 && `(${selectedPendingApprovalIds.size})`}
                                        </button>
                                    </div>
                                )}

                                {/* Tab Content */}
                                <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {getActiveTabItems().map(activity => {
                                            const req = activity.rawRequisition;
                                            const requester = allUsers.find(u => u.id === req?.requesterId);
                                            const business = businesses.find(b => b.id === req?.businessId);
                                            const isSelected = selectedPendingApprovalIds.has(activity.id);
                                            return (
                                                <div
                                                    key={activity.id}
                                                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer group ${isSelected
                                                        ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-400 dark:border-purple-500 shadow-md'
                                                        : 'bg-slate-50 dark:bg-slate-700/30 border-slate-200 dark:border-slate-700/50 hover:border-purple-300 dark:hover:border-purple-500/50 hover:shadow-md'}`}
                                                >
                                                    <div className="flex items-start gap-3 mb-2">
                                                        <button onClick={(e) => { e.stopPropagation(); togglePendingApprovalSelect(activity.id); }} className="mt-0.5 flex-shrink-0">
                                                            {isSelected ? <CheckSquare size={18} className="text-purple-500" /> : <Square size={18} className="text-slate-400" />}
                                                        </button>
                                                        <div className="flex-1 min-w-0" onClick={() => setDrawerReq(activity.rawRequisition)}>
                                                            <span className="text-xs font-mono text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-500/10">{activity.id}</span>
                                                            <h4 className="font-medium text-slate-700 dark:text-slate-200 mt-1 transition-colors truncate cursor-pointer group-hover:text-purple-600 dark:group-hover:text-purple-300">
                                                                {activity.target}
                                                            </h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500 flex-shrink-0">{activity.time}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2 ml-8">
                                                        <span className="text-slate-600 dark:text-slate-400">{requester?.name || activity.user}</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-semibold">₱{req?.totalAmount?.toLocaleString() || '0'}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-3 ml-8">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20">
                                                            {business?.name || 'N/A'}
                                                        </span>
                                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${activity.status.includes('PENDING') ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20' : 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20'}`}>
                                                            {activity.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50 ml-8">
                                                        <button
                                                            onClick={(e) => handleApprove(activity.rawRequisition, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-green-600/20 text-emerald-600 dark:text-green-400 hover:bg-emerald-100 dark:hover:bg-green-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <CheckCircle size={14} /> Approve
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleRejectClick(activity.rawRequisition, e)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-rose-50 dark:bg-red-600/20 text-rose-600 dark:text-red-400 hover:bg-rose-100 dark:hover:bg-red-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <XCircle size={14} /> Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Tab-specific empty states */}
                                        {getActiveTabItems().length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                                                <Clock size={48} className="mb-4 opacity-20" />
                                                <p className="text-sm">
                                                    {pendingApprovalTab === 'burf' && 'No pending BURF approvals found.'}
                                                    {pendingApprovalTab === 'cic' && 'No pending CIC reviews found.'}
                                                    {pendingApprovalTab === 'prf' && 'No pending PRF approvals found.'}
                                                    {pendingApprovalTab === 'gmprf' && 'No pending GM PRF approvals (≥₱50k) found.'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Ready for PRF - Visible to Purchasing Officers */}
                        {hasPermission('dashboard:section:ready_for_prf_list') && readyForPrfItems.length > 0 && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-blue-200 dark:border-blue-500/30 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-blue-100 dark:border-slate-700/50">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <FileText className="text-blue-600 dark:text-blue-400" size={20} />
                                        Ready for PRF
                                    </h3>
                                    <span className="text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-full border border-blue-200 dark:border-blue-500/20">
                                        {readyForPrfItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {readyForPrfItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            const business = businesses.find(b => b.id === req.businessId);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setDrawerReq(req)}
                                                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border-2 border-slate-200 dark:border-slate-700/50 hover:border-blue-300 dark:hover:border-blue-500/50 hover:shadow-md transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/10">{req.id}</span>
                                                            <h4
                                                                onClick={() => setDrawerReq(req)}
                                                                className="font-medium text-slate-700 dark:text-slate-200 mt-1 transition-colors truncate max-w-[250px] cursor-pointer group-hover:text-blue-600 dark:group-hover:text-blue-300"
                                                            >
                                                                {req.description}
                                                            </h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-600 dark:text-slate-400">{requester?.name || 'Unknown'}</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-3">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/10">
                                                            {business?.name || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                                                        <button
                                                            onClick={() => setPreparePRFReq(req)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <FileText size={14} /> Prepare PRF
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending Fund Release - Visible to Finance */}
                        {hasPermission('dashboard:section:pending_fund_release') && pendingFundReleaseItems.length > 0 && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-emerald-200 dark:border-emerald-500/30 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-emerald-100 dark:border-slate-700/50">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <PesoSign className="text-emerald-600 dark:text-emerald-400" size={20} />
                                        Pending Fund Release
                                    </h3>
                                    <span className="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-500/20">
                                        {pendingFundReleaseItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {pendingFundReleaseItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            const business = businesses.find(b => b.id === req.businessId);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setDrawerReq(req)}
                                                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border-2 border-slate-200 dark:border-slate-700/50 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-500/10">{req.id}</span>
                                                            <h4
                                                                onClick={() => setDrawerReq(req)}
                                                                className="font-medium text-slate-700 dark:text-slate-200 mt-1 transition-colors truncate max-w-[250px] cursor-pointer group-hover:text-emerald-600 dark:group-hover:text-emerald-300"
                                                            >
                                                                {req.description}
                                                            </h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-600 dark:text-slate-400">{requester?.name || 'Unknown'}</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                    </div>
                                                    {req.prfDetails?.supplier?.name && (
                                                        <div className="flex items-center text-xs mb-2">
                                                            <span className="text-slate-500">Supplier:</span>
                                                            <span className="text-slate-600 dark:text-slate-300 ml-1 truncate max-w-[180px]" title={req.prfDetails.supplier.name}>{req.prfDetails.supplier.name}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between text-xs mb-3">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/10">
                                                            {business?.name || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                                                        <button
                                                            onClick={() => setReleaseFundReq(req)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <PesoSign size={14} /> Release Funds
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* BR and Check Auth widgets have been moved to separate sections above */}

                        {/* Pending Audit - Visible to Auditors */}
                        {hasPermission('dashboard:section:pending_audit_list') && pendingAuditItems.length > 0 && (
                            <div className="bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-amber-200 dark:border-amber-500/30 shadow-lg flex flex-col">
                                <div className="p-6 flex justify-between items-center border-b border-amber-100 dark:border-slate-700/50">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Receipt className="text-amber-500 dark:text-amber-400" size={20} />
                                        Pending Audit
                                    </h3>
                                    <span className="text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full border border-amber-200 dark:border-amber-500/20">
                                        {pendingAuditItems.length} Pending
                                    </span>
                                </div>
                                <div className="p-5 flex-1 overflow-y-auto max-h-[600px]">
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                        {pendingAuditItems.map(req => {
                                            const requester = allUsers.find(u => u.id === req.requesterId);
                                            const business = businesses.find(b => b.id === req.businessId);
                                            return (
                                                <div
                                                    key={req.id}
                                                    onClick={() => setDrawerReq(req)}
                                                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/30 border-2 border-slate-200 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md transition-all cursor-pointer group"
                                                >
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-500/10">{req.id}</span>
                                                            <h4
                                                                onClick={() => setDrawerReq(req)}
                                                                className="font-medium text-slate-700 dark:text-slate-200 mt-1 transition-colors truncate max-w-[250px] cursor-pointer group-hover:text-amber-600 dark:group-hover:text-amber-300"
                                                            >
                                                                {req.description}
                                                            </h4>
                                                        </div>
                                                        <span className="text-xs text-slate-500">{new Date(req.dateCreated).toLocaleDateString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-2">
                                                        <span className="text-slate-600 dark:text-slate-400">{requester?.name || 'Unknown'}</span>
                                                        <span className="text-slate-700 dark:text-slate-300 font-medium">₱{req.totalAmount?.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-xs mb-3">
                                                        <span className="font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/10">
                                                            {business?.name || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                                                        <button
                                                            onClick={() => setAuditReq(req)}
                                                            className="flex-1 py-1.5 px-3 rounded-lg bg-amber-50 dark:bg-amber-600/20 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-600/30 text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                                                        >
                                                            <Receipt size={14} /> Start Audit
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>


            </div>

            {
                preparePRFReq && (
                    <PreparePRFModal
                        requisition={preparePRFReq}
                        suppliers={suppliers}
                        onClose={() => setPreparePRFReq(null)}
                        onSubmit={handlePreparePRFSubmit}
                        currentUserId={currentUser.id}
                        users={allUsers}
                    />
                )
            }

            {
                releaseFundReq && (
                    <ReleaseFundModal
                        requisition={releaseFundReq}
                        isOpen={!!releaseFundReq}
                        onClose={() => setReleaseFundReq(null)}
                        onConfirm={(checkVoucherNumber, checkVoucherLink) => {
                            const updatedReq = {
                                ...releaseFundReq,
                                status: RequisitionStatus.FUNDS_RELEASED,
                                fundReleaseDate: new Date().toISOString(),
                                checkVoucherNumber: checkVoucherNumber,
                                checkVoucherLink: checkVoucherLink,
                                // Legacy fields for backward compatibility
                                chequeNumber: checkVoucherNumber,
                                chequeImageUrl: checkVoucherLink
                            };
                            onUpdateRequisition(updatedReq);
                            setReleaseFundReq(null);
                        }}
                    />
                )
            }

            {
                auditReq && (
                    <LiquidationAuditModal
                        requisition={auditReq}
                        onClose={() => setAuditReq(null)}
                        onApprove={async (auditNotes) => {
                            const updatedReq = {
                                ...auditReq,
                                status: RequisitionStatus.AUDITED_CLEARED,
                                liquidationDetails: {
                                    ...auditReq.liquidationDetails!,
                                    auditedBy: currentUser.id,
                                    auditDate: new Date().toISOString(),
                                    auditNotes: auditNotes,
                                    status: 'APPROVED' as const
                                }
                            };
                            onUpdateRequisition(updatedReq);
                            setAuditReq(null);
                        }}
                        onReject={async (reason) => {
                            const updatedReq = {
                                ...auditReq,
                                status: RequisitionStatus.LIQUIDATION_REJECTED,
                                liquidationDetails: {
                                    ...auditReq.liquidationDetails!,
                                    auditedBy: currentUser.id,
                                    auditDate: new Date().toISOString(),
                                    auditNotes: reason,
                                    rejectionReason: reason,
                                    status: 'REJECTED' as const
                                }
                            };
                            onUpdateRequisition(updatedReq);
                            setAuditReq(null);
                        }}
                    />
                )
            }

            {/* Quick Peek Drawer for Dashboard Lists */}
            <RequisitionDrawer
                requisition={drawerReq}
                isOpen={!!drawerReq}
                onClose={() => {
                    setDrawerReq(null);
                    setSearchParams(params => {
                        const newParams = new URLSearchParams(params);
                        newParams.delete('id');
                        return newParams;
                    });
                }}
                variant="BURF"
                businesses={businesses}
                allUsers={allUsers}
                onApprove={async () => {
                    if (drawerReq && confirm(`Are you sure you want to approve ${drawerReq.id}?`)) {
                        try {
                            await RequisitionService.approveRequisition(
                                drawerReq.id,
                                currentUser.id,
                                currentUser.name
                            );
                            setDrawerReq(null);
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : 'Unknown error';
                            console.error('Error approving:', error);
                            alert(`Failed to approve: ${message}`);
                        }
                    }
                }}
                onReject={() => {
                    if (drawerReq) {
                        setRejectingReq(drawerReq);
                        setDrawerReq(null);
                    }
                }}
                onCancel={async () => {
                    if (drawerReq && confirm(`Are you sure you want to CANCEL ${drawerReq.id}? This action cannot be undone.`)) {
                        try {
                            await executeWorkflowAction({
                                requisitionId: drawerReq.id,
                                action: 'CANCEL',
                                user: {
                                    uid: currentUser.id,
                                    displayName: currentUser.name,
                                    email: currentUser.email
                                },
                                reason: 'Cancelled by SuperAdmin'
                            });
                            setDrawerReq(null);
                        } catch (error: unknown) {
                            const message = error instanceof Error ? error.message : 'Unknown error';
                            console.error('Error cancelling:', error);
                            alert(`Failed to cancel: ${message}`);
                        }
                    }
                }}
                canApprove={
                    !!drawerReq && (
                        // BURF Workflow
                        (drawerReq.status === RequisitionStatus.BURF_PENDING_MANAGER && hasPermission('approval:manager:burf')) ||
                        (drawerReq.status === RequisitionStatus.BURF_PENDING_CIC && hasPermission('approval:cic:burf')) ||
                        // PRF Workflow - Step 1: Must be the designated approver OR SuperAdmin
                        (drawerReq.status === RequisitionStatus.PRF_PENDING_MANAGER && (
                            drawerReq.prfDetails?.designatedApproverId === currentUser.id ||
                            isSuperAdmin(currentUser.role)
                        )) ||
                        // GM PRF Approval (50k+): Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL &&
                            hasPermission('approval:gm:br') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // Finance Head BR: Check if assigned for this BU
                        (drawerReq.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL &&
                            hasPermission('approval:finance_head:br') &&
                            approverAssignments.financeHeads?.some(fh =>
                                fh.userId === currentUser.id &&
                                fh.businessUnitIds.includes(drawerReq.businessId)
                            )
                        ) ||
                        // GM BR: Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                            hasPermission('approval:gm:br') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // CFO: Check if assigned as CFO
                        (drawerReq.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                            hasPermission('approval:cfo') &&
                            currentUser.id === approverAssignments.cfoUid
                        ) ||
                        // Check Auth BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // SuperAdmin can always approve (except READY_FOR_PRF which needs Prepare PRF action)
                        (isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.READY_FOR_PRF)
                    )
                }
                canReject={
                    !!drawerReq && (
                        // BURF Workflow
                        (drawerReq.status === RequisitionStatus.BURF_PENDING_MANAGER && hasPermission('approval:manager:burf')) ||
                        (drawerReq.status === RequisitionStatus.BURF_PENDING_CIC && hasPermission('approval:cic:burf')) ||
                        // PRF Workflow - Step 1: Must be the designated approver OR SuperAdmin
                        (drawerReq.status === RequisitionStatus.PRF_PENDING_MANAGER && (
                            drawerReq.prfDetails?.designatedApproverId === currentUser.id ||
                            isSuperAdmin(currentUser.role)
                        )) ||
                        // GM PRF Approval (50k+): Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_PRF_APPROVAL &&
                            hasPermission('approval:gm:br') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // Finance Head BR: Check if assigned for this BU
                        (drawerReq.status === RequisitionStatus.PENDING_FINANCE_HEAD_BR_APPROVAL &&
                            hasPermission('approval:finance_head:br') &&
                            approverAssignments.financeHeads?.some(fh =>
                                fh.userId === currentUser.id &&
                                fh.businessUnitIds.includes(drawerReq.businessId)
                            )
                        ) ||
                        // GM BR: Check if assigned as GM
                        (drawerReq.status === RequisitionStatus.PENDING_GM_BR_APPROVAL &&
                            hasPermission('approval:gm:br') &&
                            currentUser.id === approverAssignments.gmUid
                        ) ||
                        // BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_BOD_APPROVAL &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // CFO: Check if assigned as CFO
                        (drawerReq.status === RequisitionStatus.PENDING_CFO_APPROVAL &&
                            hasPermission('approval:cfo') &&
                            currentUser.id === approverAssignments.cfoUid
                        ) ||
                        // Check Auth BOD: Check if assigned as BOD approver
                        (drawerReq.status === RequisitionStatus.PENDING_CHECK_AUTH_BOD &&
                            hasPermission('approval:bod') &&
                            approverAssignments.bodApprovers?.some(bod => bod.userId === currentUser.id)
                        ) ||
                        // SuperAdmin can always reject (except READY_FOR_PRF which needs Prepare PRF action)
                        (isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.READY_FOR_PRF)
                    )
                }
                canCancel={!!drawerReq && isSuperAdmin(currentUser.role) && drawerReq.status !== RequisitionStatus.CANCELLED}
                onPreparePrf={() => {
                    if (drawerReq) {
                        setPreparePRFReq(drawerReq);
                        setDrawerReq(null);
                    }
                }}
                canPreparePrf={
                    !!drawerReq &&
                    drawerReq.status === RequisitionStatus.READY_FOR_PRF &&
                    hasPermission('requisition:prepare:prf')
                }
            />

            <RejectionModal
                isOpen={!!rejectingReq}
                onClose={() => setRejectingReq(null)}
                onConfirm={handleRejectConfirm}
                title={`Reject Requisition ${rejectingReq?.id}`}
            />
        </div >
    );
};

export default DashboardView;
