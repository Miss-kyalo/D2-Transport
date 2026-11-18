export const ROLE_HOME = {
    Admin: '/admin',
    FleetManager: '/admin',
    Driver: '/driver',
    Manufacturer: '/manufacturer',
    Client: '/client',
    SpotClient: '/client'
};

export const CLIENT_ROLES = ['Client', 'SpotClient'];
export const ADMIN_ROLES = ['Admin', 'FleetManager'];

export function getRoleHome(role) {
    return ROLE_HOME[role] || '/login';
}
