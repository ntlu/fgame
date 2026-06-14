export class AuthManager {
    static USERS = [
        { accessCode: "111", username: "NV1" },
        { accessCode: "222", username: "NV2" },
        { accessCode: "333", username: "NV3" },
        { accessCode: "444", username: "NV4" }
    ];

    static login(accessCode) {
        const user = this.USERS.find(u => u.accessCode === accessCode);
        if (user) {
            localStorage.setItem('cauca_currentUser', JSON.stringify(user));
            return user;
        }
        return null;
    }

    static logout() {
        localStorage.removeItem('cauca_currentUser');
    }

    static getCurrentUser() {
        try {
            const data = localStorage.getItem('cauca_currentUser');
            if (data) {
                return JSON.parse(data);
            }
        } catch (e) {
            console.error("Failed to parse user from localStorage", e);
        }
        return null;
    }
}
