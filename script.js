import { auth, database } from './firebase-config.js';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  signOut, 
  onAuthStateChanged,
  setPersistence, 
  browserLocalPersistence, 
  browserSessionPersistence 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  ref, 
  set, 
  get, 
  onValue 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

// Verifica se é Safari
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

// Configuração de persistência
async function initAuth() {
  try {
    // Tenta usar localStorage primeiro
    await setPersistence(auth, browserLocalPersistence);
    console.log("Persistência configurada como LOCAL (permanente)");
    
    // Verifica se o storage está disponível (especialmente para Safari)
    if (isSafari) {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
      } catch (e) {
        console.warn("LocalStorage bloqueado no Safari - usando session");
        await setPersistence(auth, browserSessionPersistence);
      }
    }
  } catch (error) {
    console.error("Erro ao configurar persistência:", error);
    // Fallback para session persistence se local falhar
    await setPersistence(auth, browserSessionPersistence);
  }
}

// Inicializa a autenticação
initAuth();

// Elementos da interface
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
const naoRegistradoSection = document.getElementById('naoRegistradoSection');
const alterarValorBtn = document.getElementById('alterarValorBtn');
const historicoBtn = document.getElementById('historicoBtn');
const salvarNovoValorBtn = document.getElementById('salvarNovoValor');
const cancelarAlteracaoBtn = document.getElementById('cancelarAlteracao');
const novoValorInput = document.getElementById('novoValorMarmita');
const valorAtualSpan = document.getElementById('valorAtual');
const voltarHistoricoBtn = document.getElementById('voltarHistorico');
const mesSelect = document.getElementById('mesSelect');
const anoSelect = document.getElementById('anoSelect');

let currentUser = null;
let precoMarmita = 0;

// Funções auxiliares
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
  const dias = Object.keys(registros || {})
    .filter(d => d.startsWith(mesAtual) && registros[d] === true);
  const total = dias.length * precoMarmita;

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
  const registro = registros && registros[hoje];
  
  if (registro === true) {
    questionSection.classList.add('hidden');
    registradoSection.classList.remove('hidden');
    naoRegistradoSection.classList.add('hidden');
  } else if (registro === false) {
    questionSection.classList.add('hidden');
    registradoSection.classList.add('hidden');
    naoRegistradoSection.classList.remove('hidden');
  } else {
    questionSection.classList.remove('hidden');
    registradoSection.classList.add('hidden');
    naoRegistradoSection.classList.add('hidden');
  }
}

function mostrarTela(tela) {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('config').classList.add('hidden');
  document.getElementById('main').classList.add('hidden');
  document.getElementById('alterarValor').classList.add('hidden');
  document.getElementById('historico').classList.add('hidden');
  document.getElementById(tela).classList.remove('hidden');
}

function populateYearSelect() {
  const currentYear = new Date().getFullYear();
  anoSelect.innerHTML = '<option value="">Selecione o ano</option>';
  
  for (let year = currentYear; year >= currentYear - 5; year--) {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    anoSelect.appendChild(option);
  }
}

function carregarHistorico() {
  const mes = mesSelect.value;
  const ano = anoSelect.value;
  
  if (!mes || !ano) {
    document.getElementById('historicoResultados').classList.add('hidden');
    document.getElementById('nenhumDado').classList.add('hidden');
    return;
  }
  
  const periodo = `${ano}-${mes}`;
  
  try {
    const registrosRef = ref(database, `users/${currentUser.uid}/registros`);
    get(registrosRef).then((snapshot) => {
      const registros = snapshot.val() || {};
      const configRef = ref(database, `users/${currentUser.uid}/config/historico`);
      
      get(configRef).then((configSnapshot) => {
        const historicoPrecos = configSnapshot.val() || {};
        
        const registrosPeriodo = Object.keys(registros)
          .filter(data => data.startsWith(periodo))
          .sort()
          .map(data => ({
            data,
            tipo: registros[data],
            valor: historicoPrecos[data] || precoMarmita
          }));
        
        if (registrosPeriodo.length === 0) {
          document.getElementById('historicoResultados').classList.add('hidden');
          document.getElementById('nenhumDado').classList.remove('hidden');
          return;
        }
        
        const marmitasComidas = registrosPeriodo.filter(r => r.tipo === true);
        const totalGasto = marmitasComidas.reduce((sum, r) => sum + r.valor, 0);
        
        const nomesMeses = [
          'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const nomeMes = nomesMeses[parseInt(mes) - 1];
        
        document.getElementById('resumoMes').innerHTML = `
          <h3>📊 Resumo de ${nomeMes}/${ano}</h3>
          <div class="resumo-stats">
            <div class="stat">
              <span class="stat-number">${marmitasComidas.length}</span>
              <span class="stat-label">Marmitas</span>
            </div>
            <div class="stat">
              <span class="stat-number">R$ ${totalGasto.toFixed(2).replace('.', ',')}</span>
              <span class="stat-label">Total Gasto</span>
            </div>
          </div>
        `;
        
        let listaHTML = '<div class="lista-header"><h4>📅 Registros do Mês</h4></div>';
        
        registrosPeriodo.forEach(registro => {
          const dataFormatada = formatarDataBrasileira(registro.data);
          const tipoIcon = registro.tipo === true ? '✅' : '❌';
          const tipoTexto = registro.tipo === true ? 'SIM' : 'NÃO';
          const valorTexto = registro.tipo === true ? `R$ ${registro.valor.toFixed(2).replace('.', ',')}` : 'R$ 0,00';
          const itemClass = registro.tipo === true ? 'item-sim' : 'item-nao';
          
          listaHTML += `
            <div class="registro-item ${itemClass}">
              <div class="registro-data">${dataFormatada}</div>
              <div class="registro-tipo">${tipoIcon} ${tipoTexto}</div>
              <div class="registro-valor">${valorTexto}</div>
            </div>
          `;
        });
        
        document.getElementById('listaMarmitas').innerHTML = listaHTML;
        document.getElementById('historicoResultados').classList.remove('hidden');
        document.getElementById('nenhumDado').classList.add('hidden');
      });
    });
  } catch (error) {
    console.error('Erro ao carregar histórico:', error);
  }
}

// Event Listeners
loginBtn.onclick = async () => {
  try {
    // Configura persistência antes de fazer login
    await setPersistence(auth, browserLocalPersistence);
    
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account' // Força a seleção de conta sempre
    });
    
    // Tenta primeiro com popup
    try {
      await signInWithPopup(auth, provider);
    } catch (popupError) {
      console.warn('Popup falhou, tentando redirecionamento:', popupError);
      // Fallback para redirecionamento
      await signInWithRedirect(auth, provider);
    }
  } catch (error) {
    console.error('Erro no login:', error);
    alert('Erro ao fazer login: ' + error.message);
  }
};

logoutBtn.onclick = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erro no logout:', error);
  }
};

// Outros event listeners (mantidos iguais)
alterarValorBtn.onclick = () => {
  valorAtualSpan.textContent = precoMarmita.toFixed(2).replace('.', ',');
  novoValorInput.value = '';
  mostrarTela('alterarValor');
};

historicoBtn.onclick = () => {
  populateYearSelect();
  mostrarTela('historico');
};

cancelarAlteracaoBtn.onclick = () => {
  mostrarTela('main');
};

voltarHistoricoBtn.onclick = () => {
  mostrarTela('main');
};

mesSelect.onchange = carregarHistorico;
anoSelect.onchange = carregarHistorico;

salvarNovoValorBtn.onclick = async () => {
  const novoValor = parseFloat(novoValorInput.value);
  if (novoValor > 0) {
    try {
      precoMarmita = novoValor;
      const configRef = ref(database, `users/${currentUser.uid}/config`);
      await set(configRef, { precoMarmita: novoValor });
      alert('Valor atualizado com sucesso! O novo valor se aplicará apenas às próximas marmitas.');
      mostrarTela('main');
      carregarRegistros();
    } catch (error) {
      console.error('Erro ao salvar novo valor:', error);
      alert('Erro ao salvar novo valor. Tente novamente.');
    }
  } else {
    alert('Por favor, insira um valor válido maior que zero.');
  }
};

// Verificação de estado de autenticação
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('userName').innerText = `${user.displayName}`;
    atualizarDataHoje();

    try {
      const configRef = ref(database, `users/${user.uid}/config`);
      const snapshot = await get(configRef);
      const data = snapshot.val();
      
      if (!data || !data.precoMarmita) {
        mostrarTela('config');
      } else {
        precoMarmita = data.precoMarmita;
        mostrarTela('main');
        carregarRegistros();
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  } else {
    currentUser = null;
    mostrarTela('auth');
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
      mostrarTela('main');
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
    const historicoRef = ref(database, `users/${currentUser.uid}/config/historico/${hoje}`);
    
    await set(registroRef, true);
    await set(historicoRef, precoMarmita);
    
    questionSection.classList.add('hidden');
    registradoSection.classList.remove('hidden');
    naoRegistradoSection.classList.add('hidden');
  } catch (error) {
    console.error('Erro ao registrar marmita:', error);
    alert('Erro ao registrar. Tente novamente.');
  }
};

naoBtn.onclick = async () => {
  try {
    const hoje = formatarDataHoje();
    const registroRef = ref(database, `users/${currentUser.uid}/registros/${hoje}`);
    
    await set(registroRef, false);
    
    questionSection.classList.add('hidden');
    registradoSection.classList.add('hidden');
    naoRegistradoSection.classList.remove('hidden');
  } catch (error) {
    console.error('Erro ao registrar:', error);
    alert('Erro ao registrar. Tente novamente.');
  }
};

// Verificação imediata ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  const user = auth.currentUser;
  if (user) {
    console.log("Usuário recuperado do estado persistente:", user.email);
    currentUser = user;
    document.getElementById('userName').innerText = user.displayName;
    mostrarTela('main');
    carregarRegistros();
  }
});