import { auth, database } from './firebase-config.js';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  ref, 
  set, 
  get, 
  onValue 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const simBtn = document.getElementById('simBtn');
const naoBtn = document.getElementById('naoBtn');
const salvarValorBtn = document.getElementById('salvarValor');
const valorInput = document.getElementById('valorMarmita');
const resumoDiv = document.getElementById('resumo');
const dataHojeSpan = document.getElementById('dataHoje');
const questionSection = document.getElementById('questionSection');
const registradoSection = document.getElementById('registradoSection');

let currentUser = null;
let precoMarmita = 0;

function formatarDataHoje() {
  return new Date().toISOString().split('T')[0];
}

function formatarDataBrasileira(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function atualizarDataHoje() {
  const hoje = formatarDataHoje();
  if (dataHojeSpan) {
    dataHojeSpan.textContent = formatarDataBrasileira(hoje);
  }
}

function atualizarResumo(registros) {
  const mesAtual = formatarDataHoje().slice(0, 7);
  const dias = Object.keys(registros || {}).filter(d => d.startsWith(mesAtual));
  const total = dias.length * precoMarmita;

  // Obter nome do mês em português
  const [ano, mes] = mesAtual.split('-');
  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const nomesMes = meses[parseInt(mes) - 1];

  resumoDiv.innerHTML = `
    <p>📅 Marmitas em ${nomesMes}/${ano}: <strong>${dias.length}</strong></p>
    <p>💸 Total gasto: <strong>R$ ${total.toFixed(2).replace('.', ',')}</strong></p>
  `;
}

function verificarRegistroHoje(registros) {
  const hoje = formatarDataHoje();
  const jaRegistrou = registros && registros[hoje];
  
  if (jaRegistrou) {
    questionSection.classList.add('hidden');
    registradoSection.classList.remove('hidden');
  } else {
    questionSection.classList.remove('hidden');
    registradoSection.classList.add('hidden');
  }
}

loginBtn.onclick = async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error('Erro no login:', error);
    alert('Erro ao fazer login. Tente novamente.');
  }
};

logoutBtn.onclick = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro no logout:', error);
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('auth').classList.add('hidden');
    document.getElementById('userName').innerText = `${user.displayName}`;
    atualizarDataHoje();

    try {
      const configRef = ref(database, `users/${user.uid}/config`);
      const snapshot = await get(configRef);
      const data = snapshot.val();
      
      if (!data || !data.precoMarmita) {
        document.getElementById('config').classList.remove('hidden');
        document.getElementById('main').classList.add('hidden');
      } else {
        precoMarmita = data.precoMarmita;
        document.getElementById('config').classList.add('hidden');
        document.getElementById('main').classList.remove('hidden');
        carregarRegistros();
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  } else {
    currentUser = null;
    document.getElementById('auth').classList.remove('hidden');
    document.getElementById('main').classList.add('hidden');
    document.getElementById('config').classList.add('hidden');
    resumoDiv.innerHTML = '';
  }
});

salvarValorBtn.onclick = async () => {
  const valor = parseFloat(valorInput.value);
  if (valor > 0) {
    try {
      precoMarmita = valor;
      const configRef = ref(database, `users/${currentUser.uid}/config`);
      await set(configRef, { precoMarmita: valor });
      document.getElementById('config').classList.add('hidden');
      document.getElementById('main').classList.remove('hidden');
      carregarRegistros();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      alert('Erro ao salvar configuração. Tente novamente.');
    }
  } else {
    alert('Por favor, insira um valor válido maior que zero.');
  }
};

function carregarRegistros() {
  try {
    const registrosRef = ref(database, `users/${currentUser.uid}/registros`);
    onValue(registrosRef, (snapshot) => {
      const registros = snapshot.val() || {};
      atualizarResumo(registros);
      verificarRegistroHoje(registros);
    });
  } catch (error) {
    console.error('Erro ao carregar registros:', error);
  }
}

simBtn.onclick = async () => {
  try {
    const hoje = formatarDataHoje();
    const registroRef = ref(database, `users/${currentUser.uid}/registros/${hoje}`);
    await set(registroRef, true);
    
    // Atualizar a interface imediatamente
    questionSection.classList.add('hidden');
    registradoSection.classList.remove('hidden');
  } catch (error) {
    console.error('Erro ao registrar marmita:', error);
    alert('Erro ao registrar. Tente novamente.');
  }
};

naoBtn.onclick = () => {
  // Criar uma animação de feedback
  naoBtn.style.transform = 'scale(0.95)';
  setTimeout(() => {
    naoBtn.style.transform = 'scale(1)';
  }, 150);
};