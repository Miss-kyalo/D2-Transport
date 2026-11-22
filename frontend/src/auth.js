export const ROLE_HOME = {
    Admin: '/admin',
    FleetManager: '/admin',
    PayrollAccountant: '/payroll',
    Boss: '/control',
    Accounts_Payable: '/control',
    Accounts_Receivable: '/control',
    Dispatcher: '/control',
    HR: '/hr/leave',
    Mechanic: '/garage/workbench',
    Storekeeper: '/garage/workbench',
    Driver: '/driver',
    Manufacturer: '/manufacturer',
    Client: '/client',
    SpotClient: '/client'
};

export const CLIENT_ROLES = ['Client', 'SpotClient'];
export const ADMIN_ROLES = ['Admin', 'FleetManager'];
export const STAFF_ROLES = [
    'Admin', 'HR', 'Accounts_Payable', 'Accounts_Receivable', 'Dispatcher',
    'FleetManager', 'Mechanic', 'Driver', 'Storekeeper', 'PayrollAccountant', 'Boss'
];

export function getRoleHome(role) {
    return ROLE_HOME[role] || '/login';
}
