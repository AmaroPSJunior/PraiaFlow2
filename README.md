# 🏖️ PraiaFlow - Intelligent Kiosk Management System

**PraiaFlow** is a high-performance, full-stack solution designed for beach kiosks and outdoor restaurants. It streamlines the ordering process, from table identification via QR Code to kitchen production and administrative management.

---

## 🚀 Key Features

### 👤 User Roles & Experiences

#### 1. **Client (Consumer)**
*   **QR Code Access**: Instant table identification without app installation.
*   **Digital Menu**: Categorized browsing with high-quality images and real-time availability.
*   **Smart Cart**: Persistent cart synchronized with Firestore to prevent data loss.
*   **Table Reservation**: Interactive floor plan to book tables in advance.
*   **PIX Payment Simulation**: Integrated flow for instant payment confirmation (simulated for dev).
*   **Real-time Tracking**: Live status updates (Pending → Preparing → Ready → Delivered).
*   **Waiter Call**: One-tap button to call a waiter or request the bill.

#### 2. **Waiter (Attendant)**
*   **Table Map**: Visual overview of all tables (Occupied, Free, Reserved).
*   **Service Dashboard**: Real-time notifications for customer calls and bill requests.
*   **Order Management**: Quick access to table details and active orders.

#### 3. **Staff (Kitchen/Bar)**
*   **KDS (Kitchen Display System)**: Kanban-style board for production management.
*   **Workflow Control**: Move orders through "New", "Preparing", and "Ready" columns.
*   **Item Availability**: (Planned) Toggle menu items as "Out of Stock" instantly.

#### 4. **Admin (Management)**
*   **Business Intelligence**: Dashboard with revenue charts, top-selling items, and performance metrics.
*   **Menu Editor**: Full CRUD for categories and items with cost/price tracking.
*   **Table Layout**: Drag-and-drop interface to organize the physical layout of the kiosk.
*   **Marketing Tools**: Management of active promotions and discount coupons.
*   **Security & Audit**: Detailed logs of all administrative actions.

---

## 🛠️ Tech Stack

*   **Frontend**: React 18+, Vite, TypeScript.
*   **Styling**: Tailwind CSS (Utility-first), Framer Motion (Animations), Lucide React (Icons).
*   **Backend**: Node.js, Express (Vite Middleware for SSR/API).
*   **Database**: Firebase Firestore (Real-time NoSQL).
*   **Authentication**: Firebase Auth (Google Login) + Custom Mock Auth for Development.
*   **Internationalization**: Custom Context-based I18n (PT-BR, EN, ES).
*   **Theming**: Dark/Light mode support with system preference detection.

---

## 📂 Project Structure

```text
├── src/
│   ├── components/       # UI Components (Home, Client, Waiter, Staff, Admin)
│   ├── lib/              # Contexts (Language, Theme) and Firebase config
│   ├── services/         # API and Database logic
│   ├── types.ts          # Global TypeScript interfaces
│   ├── constants.ts      # Shared constants and mock data
│   └── main.tsx          # Application entry point
├── firestore.rules       # Security rules for production
├── firebase-blueprint.json # Database schema definition
├── server.ts             # Express server with Vite middleware
└── seed.ts               # Database initialization script
```

---

## ⚙️ Development & Setup

### 1. Installation
```bash
npm install
```

### 2. Database Initialization
To populate the Firestore with initial categories, items, and tables:
```bash
npm run seed
```

### 3. Development Login (Mock Auth)
For rapid testing, the login screen includes a **Development Login** section. This allows you to impersonate any role without a real Google account:
*   **Admin Dev**: Full access to management.
*   **Waiter Dev**: Access to the table map and calls.
*   **Staff Dev**: Access to the kitchen production board.
*   **Client Dev**: Standard consumer experience.

### 4. Running the App
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

---

## 🧪 Testes & Qualidade

O PraiaFlow possui uma suíte de testes integrada para garantir a integridade das regras de negócio.

### 1. Executando os Testes
Acesse a aba **"Regras de Negócio"** no painel **Root Access** (`/root`).
*   **Sincronizar**: Clique no botão de sincronização para garantir que os testes no disco (`src/tests/business/`) estejam alinhados com o Firestore.
*   **Executar Suite**: Roda todos os testes cadastrados e exibe um resumo de sucessos/falhas.
*   **CRUD de Testes**: Você pode criar, editar e excluir regras de negócio e seus respectivos cenários de teste diretamente pela interface.

### 2. Estrutura de Testes
Os testes são escritos em um formato simplificado (estilo Jest) e executados em um ambiente de mock que simula as funções do sistema (`validateMenuItem`, `calculateTotal`, etc.).

---

## 📖 Documentação da API (Swagger)

A API do PraiaFlow é documentada utilizando **Swagger (OpenAPI 3.0)**.

### 1. Acessando a Documentação
Com o servidor rodando, acesse:
`http://localhost:3000/api-docs`

Lá você encontrará todos os endpoints disponíveis, parâmetros necessários e exemplos de resposta para:
*   **Sincronização de Testes**
*   **Configurações do Sistema**
*   **Criação de Pagamentos (Mercado Pago)**
*   **Webhooks de Notificação**

### 2. API Tester (Painel Root)
Para testes rápidos sem sair da aplicação, utilize a aba **"API Tester"** no painel Root. Ela permite:
*   Selecionar o método HTTP (GET, POST, PUT, DELETE).
*   Digitar a URL do endpoint.
*   Enviar um corpo de requisição (JSON).
*   Visualizar a resposta formatada e o tempo de execução.
*   Acessar o histórico das últimas 10 requisições.

---

## 🔒 Security Rules

The project includes a robust `firestore.rules` file that implements:
*   **Role-Based Access Control (RBAC)**: Admins can manage everything; Waiters can view tables/calls; Clients can only manage their own orders.
*   **Data Validation**: Strict type checking and size limits for all Firestore writes.
*   **PII Protection**: Sensitive user data is restricted to the document owner.

---

## 📱 Accessibility & Design

*   **High Contrast**: Optimized for outdoor use under direct sunlight.
*   **Mobile-First**: Responsive design that works perfectly on smartphones (clients/waiters) and tablets (kitchen/admin).
*   **Micro-interactions**: Smooth transitions using `framer-motion` to guide the user.

---

Desenvolvido para proporcionar a melhor experiência à beira-mar. 🌊🧉
