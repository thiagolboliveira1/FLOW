// CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");

const userNameSpan = document.getElementById("user-name");
const balanceAmountSpan = document.getElementById("balance-amount");
const totalIncomeSpan = document.getElementById("total-income");
const totalExpenseSpan = document.getElementById("total-expense");
const percentExpensesSpan = document.getElementById("percent-expenses");
const currentMonthLabelSpan = document.getElementById("current-month-label");
const categoryList = document.getElementById("category-list");

const transactionsList = document.getElementById("transactions-list");
const billsList = document.getElementById("bills-list");
const servicesList = document.getElementById("services-list");

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginError = document.getElementById("login-error");
const registerError = document.getElementById("register-error");

const transactionForm = document.getElementById("transaction-form");
const billForm = document.getElementById("bill-form");
const serviceForm = document.getElementById("service-form");

const logoutBtn = document.getElementById("btn-logout");
const resetPassBtn = document.getElementById("btn-reset-password");

const authTabs = document.querySelectorAll(".auth-tab");
const authForms = document.querySelectorAll(".auth-form");

const topTabs = document.querySelectorAll(".top-tab");
const bottomNavBtns = document.querySelectorAll(".bottom-nav-btn");
const tabContents = document.querySelectorAll(".tab-content");

let currentUser = null;
let unsubscribeTransactions = null;
let unsubscribeBills = null;
let unsubscribeServices = null;

function formatCurrency(value) {
  if (isNaN(value)) value = 0;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function setCurrentMonthLabel() {
  const now = new Date();
  const label = now.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });
  currentMonthLabelSpan.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

authTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    authTabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    const target = btn.dataset.authTab;
    authForms.forEach((form) => {
      if (form.id === `${target}-form`) {
        form.classList.add("active");
      } else {
        form.classList.remove("active");
      }
    });

    loginError.textContent = "";
    registerError.textContent = "";
  });
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    console.error(err);
    loginError.textContent = traduzErroFirebase(err.code);
  }
});

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  registerError.textContent = "";

  const name = document.getElementById("register-name").value.trim();
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value;

  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await cred.user.updateProfile({ displayName: name });

    await db.collection("users").doc(cred.user.uid).set({
      name,
      email,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error(err);
    registerError.textContent = traduzErroFirebase(err.code);
  }
});

resetPassBtn.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    loginError.textContent = "Digite seu e-mail para receber o link de redefinição.";
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    loginError.textContent = "Link de redefinição enviado para seu e-mail.";
  } catch (err) {
    console.error(err);
    loginError.textContent = traduzErroFirebase(err.code);
  }
});

logoutBtn.addEventListener("click", async () => {
  await auth.signOut();
});

auth.onAuthStateChanged((user) => {
  currentUser = user;
  if (user) {
    authScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    userNameSpan.textContent = user.displayName || (user.email ? user.email.split("@")[0] : "Usuário");

    setCurrentMonthLabel();
    startFirestoreListeners();
  } else {
    stopFirestoreListeners();

    authScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
  }
});

function traduzErroFirebase(code) {
  switch (code) {
    case "auth/user-not-found":
      return "Usuário não encontrado.";
    case "auth/wrong-password":
      return "Senha incorreta.";
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/weak-password":
      return "Senha muito fraca (mínimo 6 caracteres).";
    case "auth/invalid-email":
      return "E-mail inválido.";
    default:
      return "Ocorreu um erro. Tente novamente.";
  }
}

function startFirestoreListeners() {
  if (!currentUser) return;

  const uid = currentUser.uid;

  unsubscribeTransactions = db
    .collection("users")
    .doc(uid)
    .collection("transactions")
    .orderBy("date", "desc")
    .limit(50)
    .onSnapshot((snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      renderTransactions(data);
      updateResumoFromTransactions(data);
    });

  unsubscribeBills = db
    .collection("users")
    .doc(uid)
    .collection("bills")
    .orderBy("dueDate", "asc")
    .onSnapshot((snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      renderBills(data);
    });

  unsubscribeServices = db
    .collection("users")
    .doc(uid)
    .collection("services")
    .orderBy("createdAt", "desc")
    .onSnapshot((snapshot) => {
      const data = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      renderServices(data);
    });
}

function stopFirestoreListeners() {
  if (unsubscribeTransactions) unsubscribeTransactions();
  if (unsubscribeBills) unsubscribeBills();
  if (unsubscribeServices) unsubscribeServices();

  unsubscribeTransactions = null;
  unsubscribeBills = null;
  unsubscribeServices = null;
}

transactionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const type = document.getElementById("transaction-type").value;
  const category = document.getElementById("transaction-category").value.trim();
  const description = document.getElementById("transaction-description").value.trim();
  const amount = parseFloat(document.getElementById("transaction-amount").value);
  const date = document.getElementById("transaction-date").value;

  if (isNaN(amount)) return;

  const uid = currentUser.uid;

  try {
    await db.collection("users").doc(uid).collection("transactions").add({
      type,
      category,
      description,
      amount,
      date,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    transactionForm.reset();
  } catch (err) {
    console.error("Erro ao salvar transação:", err);
  }
});

function renderTransactions(transactions) {
  transactionsList.innerHTML = "";

  if (!transactions.length) {
    transactionsList.innerHTML = `<li><span class="muted small">Nenhum lançamento ainda.</span></li>`;
    return;
  }

  transactions.forEach((t) => {
    const li = document.createElement("li");

    const labelDiv = document.createElement("div");
    labelDiv.className = "label";
    const main = document.createElement("span");
  main.textContent = t.category || (t.type === "receita" ? "Receita" : "Despesa");
    const sub = document.createElement("span");
    sub.textContent = `${t.description || ""} ${t.date ? "• " + formatDate(t.date) : ""}`.trim();
    const badge = document.createElement("span");
    badge.className = "badge " + (t.type === "receita" ? "income" : "expense");
    badge.textContent = t.type === "receita" ? "Receita" : "Despesa";

    labelDiv.appendChild(main);
    if (sub.textContent) labelDiv.appendChild(sub);
    labelDiv.appendChild(badge);

    const valueDiv = document.createElement("div");
    valueDiv.className = "value";
    valueDiv.textContent = formatCurrency(t.amount || 0);

    li.appendChild(labelDiv);
    li.appendChild(valueDiv);

    transactionsList.appendChild(li);
  });
}

function updateResumoFromTransactions(transactions) {
  let totalIncome = 0;
  let totalExpense = 0;
  const categories = {};

  transactions.forEach((t) => {
    const value = Number(t.amount) || 0;
    if (t.type === "receita") {
      totalIncome += value;
    } else {
      totalExpense += value;
    }

    const key = t.category || (t.type === "receita" ? "Receitas" : "Despesas");
    if (!categories[key]) categories[key] = 0;
    if (t.type === "receita") {
      categories[key] += value;
    } else {
      categories[key] -= value;
    }
  });

  const balance = totalIncome - totalExpense;
  balanceAmountSpan.textContent = formatCurrency(balance);
  totalIncomeSpan.textContent = `Entradas: ${formatCurrency(totalIncome)}`;
  totalExpenseSpan.textContent = `Saídas: ${formatCurrency(totalExpense)}`;

  const percent = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;
  percentExpensesSpan.textContent = `${percent}%`;

  categoryList.innerHTML = "";
  const categoryKeys = Object.keys(categories);
  if (!categoryKeys.length) {
    categoryList.innerHTML = `<li><span class="muted small">Sem dados de categorias ainda.</span></li>`;
    return;
  }

  categoryKeys.forEach((cat) => {
    const li = document.createElement("li");

    const label = document.createElement("div");
    label.className = "label";
    const nameSpan = document.createElement("span");
    nameSpan.textContent = cat;
    const detailSpan = document.createElement("span");
    detailSpan.textContent = "Impacto no mapa de análise";

    label.appendChild(nameSpan);
    label.appendChild(detailSpan);

    const amount = categories[cat];
    const valueDiv = document.createElement("div");
    valueDiv.className = "value";
    valueDiv.textContent = formatCurrency(amount);

    li.appendChild(label);
    li.appendChild(valueDiv);

    categoryList.appendChild(li);
  });
}

billForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const type = document.getElementById("bill-type").value;
  const description = document.getElementById("bill-description").value.trim();
  const amount = parseFloat(document.getElementById("bill-amount").value);
  const dueDate = document.getElementById("bill-due-date").value;
  const status = document.getElementById("bill-status").value;

  if (isNaN(amount)) return;

  const uid = currentUser.uid;

  try {
    await db.collection("users").doc(uid).collection("bills").add({
      type,
      description,
      amount,
      dueDate,
      status,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    billForm.reset();
  } catch (err) {
    console.error("Erro ao salvar conta:", err);
  }
});

function renderBills(bills) {
  billsList.innerHTML = "";

  const pendentes = bills.filter((b) => b.status === "pendente");

  if (!pendentes.length) {
    billsList.innerHTML = `<li><span class="muted small">Nenhuma conta pendente. 🎉</span></li>`;
    return;
  }

  pendentes.forEach((b) => {
    const li = document.createElement("li");

    const labelDiv = document.createElement("div");
    labelDiv.className = "label";

    const main = document.createElement("span");
    main.textContent = b.description;

    const sub = document.createElement("span");
    const tipo = b.type === "pagar" ? "A pagar" : "A receber";
    sub.textContent = `${tipo} • vence em ${formatDate(b.dueDate)}`;

    labelDiv.appendChild(main);
    labelDiv.appendChild(sub);

    const valueDiv = document.createElement("div");
    valueDiv.className = "value";
    valueDiv.textContent = formatCurrency(b.amount || 0);

    li.appendChild(labelDiv);
    li.appendChild(valueDiv);

    billsList.appendChild(li);
  });
}

serviceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentUser) return;

  const name = document.getElementById("service-name").value.trim();
  const materials = parseFloat(document.getElementById("service-materials").value);
  const labor = parseFloat(document.getElementById("service-labor").value);
  const overheadPercent = parseFloat(document.getElementById("service-overhead").value);
  const profitPercent = parseFloat(document.getElementById("service-profit").value);

  if (!name || isNaN(materials) || isNaN(labor)) return;

  const baseCost = materials + labor;
  const overheadValue = baseCost * (overheadPercent / 100);
  const costWithOverhead = baseCost + overheadValue;
  const profitValue = costWithOverhead * (profitPercent / 100);
  const finalPrice = costWithOverhead + profitValue;

  const uid = currentUser.uid;

  try {
    await db.collection("users").doc(uid).collection("services").add({
      name,
      materials,
      labor,
      overheadPercent,
      profitPercent,
      baseCost,
      overheadValue,
      profitValue,
      finalPrice,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    serviceForm.reset();
  } catch (err) {
    console.error("Erro ao salvar serviço:", err);
  }
});

function renderServices(services) {
  servicesList.innerHTML = "";

  if (!services.length) {
    servicesList.innerHTML = `<li><span class="muted small">Nenhum serviço calculado ainda.</span></li>`;
    return;
  }

  services.forEach((s) => {
    const li = document.createElement("li");

    const labelDiv = document.createElement("div");
    labelDiv.className = "label";

    const main = document.createElement("span");
    main.textContent = s.name;

    const sub = document.createElement("span");
    sub.textContent = `Custo: ${formatCurrency(s.baseCost || 0)} • Margem: ${s.profitPercent || 0}%`;

    labelDiv.appendChild(main);
    labelDiv.appendChild(sub);

    const valueDiv = document.createElement("div");
    valueDiv.className = "value";
    valueDiv.textContent = formatCurrency(s.finalPrice || 0);

    li.appendChild(labelDiv);
    li.appendChild(valueDiv);

    servicesList.appendChild(li);
  });
}

function activateTab(tabId) {
  tabContents.forEach((section) => {
    if (section.id === `tab-${tabId}`) {
      section.classList.add("active");
    } else {
      section.classList.remove("active");
    }
  });

  topTabs.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  bottomNavBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
}

topTabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    activateTab(btn.dataset.tab);
  });
});

bottomNavBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    activateTab(btn.dataset.tab);
  });
});

window.addEventListener("DOMContentLoaded", () => {
  const today = new Date().toISOString().slice(0, 10);
  const txDate = document.getElementById("transaction-date");
  const billDueDate = document.getElementById("bill-due-date");
  if (txDate) txDate.value = today;
  if (billDueDate) billDueDate.value = today;

  setCurrentMonthLabel();
});
