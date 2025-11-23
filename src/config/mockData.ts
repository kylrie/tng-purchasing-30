import { UserRole } from '../features/auth/types';
import type { User } from '../features/auth/types';
import type { Business } from '../shared/types';
import type { Requisition, Supplier } from '../features/procurement/types';

export const INITIAL_MOCK_USERS: User[] = [
    // Super Admin Fallback / Seed Account
    {
        id: 'super-admin-001',
        name: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        avatar: '',
        email: 'super@thenextperience.com',
        department: 'HQ',
        businessId: 'b1',
        permissionLevel: 10
    }
];

export const initialBusinesses: Business[] = [
    {
        id: 'b1',
        name: 'THE FUN GUYS CORP.',
        currency: 'PHP',
        address: 'Matheus Building, 5382 General Luna St. Poblacion, City of Makati, Fourth District, National Capital Region (NCR), 1210',
        tin: '618-365-031'
    },
    {
        id: 'b2',
        name: 'ATHOUSANDCONCEPTS INC.',
        currency: 'PHP',
        address: 'Unit 124, 126, 127, Ground Level, S Maison Mall, Brgy 76, Pasay City 1300',
        tin: '009-866-824-000'
    },
    {
        id: 'b3',
        name: 'BEACHBOSSES INC.',
        currency: 'PHP',
        address: '5 National Highway, Barrio Barretto Olongapo City',
        tin: '009-573-616-000'
    },
    {
        id: 'b4',
        name: 'BAKEBEPH INC. SMaison',
        currency: 'PHP',
        address: 'Unit 124, 126, 127, Ground Level, S Maison Mall, Brgy 76, Pasay City 1300',
        tin: '010-457-012-000'
    },
    {
        id: 'b5',
        name: 'BAKEBEPH INC.',
        currency: 'PHP',
        address: 'Unit 355, 3rd Level, SM Aura, Mckinley Parkway, Fort Bonifacio, Taguig City 1630',
        tin: '010-457-012-000'
    },
    {
        id: 'b6',
        name: 'THENIPKIT INC.',
        currency: 'PHP',
        address: '8591 Esmeralda St. Marcelo Green Village, Marcelo Green, Paranaque City 1700',
        tin: '010-445-402-000'
    },
    {
        id: 'b7',
        name: 'SLIMETOLOGY INC.',
        currency: 'PHP',
        address: 'Unit EM 348, MM333, MM 353 SM Central Business Park, 123 Seaside Blvd. SM Mall of Asia, Barangay 76, PASAY CITY, NCR, FOURTH DISTRICT, Philippines',
        tin: '010-474-568-000'
    },
    {
        id: 'b8',
        name: 'SLIMETOLOGY INC. SM North Edsa',
        currency: 'PHP',
        address: 'Ane 323 The Block, SM North Edsa, Bagong Pag-asa 1105, Quezcon City-00002 NCR, Second District, Philippines',
        tin: '010-474-568-000'
    }
];

export const initialSuppliers: Supplier[] = [];

export const initialRequisitions: Requisition[] = [];
