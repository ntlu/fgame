export class AuthManager {
    static USERS = [
        { accessCode: "111", username: "NV1" },
        { accessCode: "222", username: "NV2" },
        { accessCode: "333", username: "NV3" },
        { accessCode: "444", username: "NV4" },
        { accessCode: "555", username: "NV5" },
        { accessCode: "666", username: "NV6" },
        { accessCode: "777", username: "NV7" },
        { accessCode: "888", username: "NV8" },
        { accessCode: "999", username: "NV9" }
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
