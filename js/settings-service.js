export class SettingsService {
    constructor(db, userId) {
        this.db = db;
        this.userId = userId;
    }

    // --- Categorias ---
    async getCategories() {
        const snapshot = await this.db.collection('users').doc(this.userId).collection('categories').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveCategory(category) {
        const { id, ...data } = category;
        if (id) {
            return await this.db.collection('users').doc(this.userId).collection('categories').doc(id).update(data);
        } else {
            return await this.db.collection('users').doc(this.userId).collection('categories').add(data);
        }
    }

    async deleteCategory(id) {
        return await this.db.collection('users').doc(this.userId).collection('categories').doc(id).delete();
    }

    // --- Formas de Pagamento ---
    async getPaymentMethods() {
        const snapshot = await this.db.collection('users').doc(this.userId).collection('paymentMethods').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async savePaymentMethod(method) {
        const { id, ...data } = method;
        if (id) {
            return await this.db.collection('users').doc(this.userId).collection('paymentMethods').doc(id).update(data);
        } else {
            return await this.db.collection('users').doc(this.userId).collection('paymentMethods').add(data);
        }
    }

    async deletePaymentMethod(id) {
        return await this.db.collection('users').doc(this.userId).collection('paymentMethods').doc(id).delete();
    }

    // --- Dívidas Fixas ---
    async getFixedDebts() {
        const snapshot = await this.db.collection('users').doc(this.userId).collection('fixedDebts').orderBy('name').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveFixedDebt(debt) {
        const { id, ...data } = debt;
        if (id) {
            return await this.db.collection('users').doc(this.userId).collection('fixedDebts').doc(id).update(data);
        } else {
            return await this.db.collection('users').doc(this.userId).collection('fixedDebts').add(data);
        }
    }

    async deleteFixedDebt(id) {
        return await this.db.collection('users').doc(this.userId).collection('fixedDebts').doc(id).delete();
    }
}