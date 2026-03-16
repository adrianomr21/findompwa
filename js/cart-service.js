export class CartService {
    constructor(db, userId) {
        this.db = db;
        this.userId = userId;
    }

    // Gerenciamento de Carrinhos (Grupos)
    async getCarts() {
        const snapshot = await this.db.collection('carrinhos')
            .where('userId', '==', this.userId)
            .orderBy('createdAt', 'asc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async saveCart(cart) {
        const { id, ...data } = cart;
        if (id) {
            await this.db.collection('carrinhos').doc(id).update(data);
            return id;
        } else {
            const docRef = await this.db.collection('carrinhos').add({
                ...data,
                userId: this.userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        }
    }

    async deleteCart(cartId) {
        const items = await this.getItems(cartId);
        const batch = this.db.batch();
        items.forEach(item => {
            batch.delete(this.db.collection('carrinho_itens').doc(item.id));
        });
        batch.delete(this.db.collection('carrinhos').doc(cartId));
        await batch.commit();
    }

    // Gerenciamento de Itens
    async getItems(cartId) {
        // Removido orderBy para evitar necessidade de índice composto inicialmente
        const snapshot = await this.db.collection('carrinho_itens')
            .where('userId', '==', this.userId)
            .where('cartId', '==', cartId)
            .get();
        
        // Ordenação manual simples por data de criação para manter interface organizada
        return snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    }

    async saveItem(item) {
        const { id, ...data } = item;
        if (id) {
            await this.db.collection('carrinho_itens').doc(id).update(data);
            return id;
        } else {
            const docRef = await this.db.collection('carrinho_itens').add({
                ...data,
                userId: this.userId,
                bought: false,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return docRef.id;
        }
    }

    async deleteItem(itemId) {
        await this.db.collection('carrinho_itens').doc(itemId).delete();
    }

    async toggleItemBought(itemId, bought) {
        await this.db.collection('carrinho_itens').doc(itemId).update({ bought });
    }
}
