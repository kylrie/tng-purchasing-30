import { useState } from 'react';
import { Box, Typography, Tab, Tabs, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';
import { useRequisitions } from '../hooks/useRequisitions';
import { useAuth } from '../../../shared/hooks/useAuth';
import { RequisitionGrid } from '../components/RequisitionGrid';
import { RequisitionStatus, UserRole, Requisition } from '../types';
import { RequisitionService } from '../services/requisitions.service';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`prf-tabpanel-${index}`}
      aria-labelledby={`prf-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const PRFView: React.FC = () => {
  const { user } = useAuth();
  const { requisitions, loading, error, refreshRequisitions } = useRequisitions();
  const [tabIndex, setTabIndex] = useState(0);
  const [isModalOpen, setModalOpen] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [prfIdentifier, setPrfIdentifier] = useState('');
  
  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabIndex(newValue);
  };

  const handleOpenModal = (requisition: Requisition) => {
    setSelectedRequisition(requisition);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedRequisition(null);
    setPrfIdentifier('');
  };

  const handleCreatePrf = async () => {
    if (selectedRequisition && prfIdentifier) {
      try {
        await RequisitionService.updateRequisition(selectedRequisition.id, {
          prfIdentifier,
          status: RequisitionStatus.PRF_PENDING_MANAGER,
        });
        await RequisitionService.addHistoryEntry(
          selectedRequisition.id,
          user!.id,
          user!.name,
          'PRF Created',
          RequisitionStatus.PRF_PENDING_MANAGER
        );
        refreshRequisitions(); // Refresh data
        handleCloseModal();
      } catch (err) {
        console.error('Error creating PRF:', err);
      }
    }
  };
  
  // Filter requisitions based on status and user role
  const filterRequisitions = (statuses: RequisitionStatus[]) => {
    if (!user) return [];
    return requisitions.filter(req => {
      const isUserBusiness = req.businessId === user.businessId;
      const hasCorrectStatus = statuses.includes(req.status);

      if ([UserRole.SUPER_ADMIN, UserRole.PURCHASING_OFFICER, UserRole.ADMIN].includes(user.role)) {
        return hasCorrectStatus;
      }

      return isUserBusiness && hasCorrectStatus;
    });
  };

  const readyForPrf = filterRequisitions([RequisitionStatus.READY_FOR_PRF]);
  const pendingManagerApproval = filterRequisitions([RequisitionStatus.PRF_PENDING_MANAGER]);
  const approvedForPayment = filterRequisitions([RequisitionStatus.APPROVED_FOR_PAYMENT]);
  const rejected = filterRequisitions([RequisitionStatus.REJECTED]);
  
  if (loading) return <Typography>Loading...</Typography>;
  if (error) return <Typography color="error">{error}</Typography>;

  // Check if user is a Purchasing Officer
  const isPurchasingOfficer = user?.role === UserRole.PURCHASING_OFFICER;

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>PRF Management</Typography>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={handleChange} aria-label="PRF workflow tabs">
          <Tab label={`Ready for PRF (${readyForPrf.length})`} />
          <Tab label={`Pending Approval (${pendingManagerApproval.length})`} />
          <Tab label={`Approved (${approvedForPayment.length})`} />
          <Tab label={`Rejected (${rejected.length})`} />
        </Tabs>
      </Box>

      <TabPanel value={tabIndex} index={0}>
        <RequisitionGrid 
          requisitions={readyForPrf} 
          title="Ready for PRF Creation"
          isManagerOrCic={false}
          customActions={isPurchasingOfficer ? [
            {
              label: 'Create PRF',
              onClick: handleOpenModal,
              icon: <div />
            }
          ] : []}
        />
      </TabPanel>

      <TabPanel value={tabIndex} index={1}>
        <RequisitionGrid 
          requisitions={pendingManagerApproval} 
          title="Pending Manager Approval"
          isManagerOrCic={user?.role === UserRole.MANAGER} // Only managers can approve
        />
      </TabPanel>

      <TabPanel value={tabIndex} index={2}>
        <RequisitionGrid 
          requisitions={approvedForPayment} 
          title="Approved & Pending Fund Release" 
          isManagerOrCic={false}
        />
      </TabPanel>

      <TabPanel value={tabIndex} index={3}>
        <RequisitionGrid 
          requisitions={rejected} 
          title="Rejected PRFs"
          isManagerOrCic={false} // For re-filing
        />
      </TabPanel>

      {/* PRF Creation Modal */}
      <Dialog open={isModalOpen} onClose={handleCloseModal}>
        <DialogTitle>Create PRF</DialogTitle>
        <DialogContent>
          <Typography>Requisition ID: {selectedRequisition?.id}</Typography>
          <TextField
            autoFocus
            margin="dense"
            label="PRF Identifier"
            type="text"
            fullWidth
            variant="standard"
            value={prfIdentifier}
            onChange={(e) => setPrfIdentifier(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal}>Cancel</Button>
          <Button onClick={handleCreatePrf}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
