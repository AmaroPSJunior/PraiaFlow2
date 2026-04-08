import { db } from './src/lib/firebase.ts';
import { collection, addDoc, getDocs, query, where, deleteDoc, setDoc, doc } from 'firebase/firestore';

const initialMenu = [
  { name: 'Cerveja Pilsen 600ml', description: 'Gelada no ponto', price: 18.0, category: 'bebidas', available: true, imageUrl: 'https://picsum.photos/seed/beer/400/300' },
  { name: 'Água de Coco', description: 'Natural e refrescante', price: 10.0, category: 'bebidas', available: true, imageUrl: 'https://picsum.photos/seed/coconut/400/300' },
  { name: 'Caipirinha Limão', description: 'Cachaça artesanal', price: 22.0, category: 'bebidas', available: true, imageUrl: 'https://picsum.photos/seed/caipirinha/400/300' },
  { name: 'Isca de Peixe', description: 'Acompanha molho tártaro', price: 65.0, category: 'petiscos', available: true, imageUrl: 'https://picsum.photos/seed/fish/400/300' },
  { name: 'Batata Frita', description: 'Porção generosa', price: 35.0, category: 'petiscos', available: true, imageUrl: 'https://picsum.photos/seed/fries/400/300' },
  { name: 'Camarão Alho e Óleo', description: 'Camarão médio selecionado', price: 85.0, category: 'petiscos', available: true, imageUrl: 'https://picsum.photos/seed/shrimp/400/300' },
  { name: 'Moqueca de Peixe', description: 'Para 2 pessoas', price: 140.0, category: 'refeicoes', available: true, imageUrl: 'https://picsum.photos/seed/moqueca/400/300' },
  { name: 'Açaí na Tigela', description: 'Com granola e banana', price: 25.0, category: 'sobremesas', available: true, imageUrl: 'https://picsum.photos/seed/acai/400/300' },
];

const initialTables = [
  { number: 1, active: true },
  { number: 2, active: true },
  { number: 3, active: true },
  { number: 4, active: true },
  { number: 5, active: true },
];

async function seed() {
  console.log('Seeding data...');

  // Clear existing menu
  const menuSnap = await getDocs(collection(db, 'menu'));
  for (const doc of menuSnap.docs) {
    await deleteDoc(doc.ref);
  }

  // Add menu items
  for (const item of initialMenu) {
    await addDoc(collection(db, 'menu'), item);
  }

  // Clear existing tables
  const tableSnap = await getDocs(collection(db, 'tables'));
  for (const doc of tableSnap.docs) {
    await deleteDoc(doc.ref);
  }

  // Add tables
  for (const table of initialTables) {
    await setDoc(doc(db, 'tables', `table_${table.number}`), table);
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(console.error);
