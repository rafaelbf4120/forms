// IMPORTAÇÕES
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, addDoc, deleteDoc, onSnapshot, collection, doc, query, where, getDocs, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// CONFIGURAÇÃO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyDmqvcKtIsga4ZQWNDg4_2k493dqMQCDVg",
    authDomain: "teste-ebf38.firebaseapp.com",
    projectId: "teste-ebf38",
    storageBucket: "teste-ebf38.firebasestorage.app",
    messagingSenderId: "741884776297",
    appId: "1:741884776297:web:a23450b4909581a1b237f8",
    measurementId: "G-2MD5CFD51E"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const globalAppId = typeof __app_id !== 'undefined' ?
    __app_id : 'default-app-id';
let globalUserId = null;
let currentUser = {
    username: null,
    isAdmin: false,
};
// ELEMENTOS DOM
const loginForm = document.getElementById('login-form');
const loginPage = document.getElementById('login-page');
const appPage = document.getElementById('app-page');
const loginMessage = document.getElementById('login-message');
const userIdDisplay = document.getElementById('user-id-display');
const logoutButton = document.getElementById('logout-btn');
const motoristaInput = document.getElementById('motorista');
const openMotoristasBtn = document.getElementById('open-motoristas-modal');
const passageirosContainer = document.getElementById('passageiros-campos-container');
const addPassageiroBtn = document.getElementById('add-passageiro-btn');
const downloadCsvBtn = document.getElementById('download-csv');
const downloadCsvCustomBtn = document.getElementById('download-csv-custom'); 
const csvReportDiv = downloadCsvBtn.closest('.flex-col');

const solicitanteContainer = document.getElementById('solicitante-campos-container');
const addSolicitanteBtn = document.getElementById('add-solicitante-btn');
const destinoContainer = document.getElementById('destino-campos-container');
const addDestinoBtn = document.getElementById('add-destino-btn');
const valorContainer = document.getElementById('valor-campos-container');
const addValorBtn = document.getElementById('add-valor-btn');
const editValorBtn = document.getElementById('add-edit-valor-btn');

// === CONFIGURAÇÃO DE USUÁRIOS ===
const users = [
    { username: 'admin', password: 'rafael22' },
    { username: 'gerente', password: 'senha123' },
    { username: 'motorista1', password: 'senha123' }
];
const motoristaUsers = {
    'admin': { nome: 'Administrador Principal', is_admin: true, is_motorista_fixo: false, userId: 'motorista-admin-id' },
    'gerente': { nome: 'Gerente Operacional', is_admin: true, is_motorista_fixo: false, userId: 'motorista-gerente-id' },
    'motorista1': { nome: 'João da Silva', is_admin: false, is_motorista_fixo: true, userId: 'motorista-joao-id' },
};
let transportadosData = [];
let motoristasData = [];
let lancamentosData = [];
let matriculaToNome = {};
let nomeToMatricula = {};
// === FUNÇÕES DE VALIDAÇÃO E INTERFACE ===

function showWarning(message) {
    document.getElementById('message-content').innerText = message;
    document.getElementById('message-modal').classList.remove('hidden');
}

function hideWarning() {
    document.getElementById('message-modal').classList.add('hidden');
}

function setMotoristaReadOnly(username) {
    const userData = motoristaUsers[username];
    currentUser.username = username;
    currentUser.isAdmin = userData ? userData.is_admin : false;
    globalUserId = userData ? userData.userId : null;
    userIdDisplay.innerText = `ID do Usuário: ${globalUserId}`;

    if (userData && userData.is_admin) {
        openMotoristasBtn.classList.remove('hidden');
        csvReportDiv.classList.remove('hidden');
    } else {
        openMotoristasBtn.classList.add('hidden');
        csvReportDiv.classList.add('hidden');
    }

    if (userData && userData.is_motorista_fixo) {
        motoristaInput.value = userData.nome;
        motoristaInput.setAttribute('readonly', 'readonly');
        motoristaInput.classList.add('bg-gray-200');
    } else {
        motoristaInput.removeAttribute('readonly');
        motoristaInput.classList.remove('bg-gray-200');
        motoristaInput.value = userData ? userData.nome : '';
    }
}

function checkPassageiroDuplicidade(sourceInput) {
    const rows = document.querySelectorAll('#passageiros-campos-container .passageiro-row');
    const row = sourceInput.closest('.passageiro-row');
    const currentMatriculaInput = row.querySelector('input[name="matriculas[]"]');
    const currentNomeInput = row.querySelector('input[name="transportados[]"]');
    const currentMatricula = currentMatriculaInput.value.trim();
    const currentNome = currentNomeInput.value.trim();
    if (currentMatricula === '' || currentNome === '') {
        currentMatriculaInput.classList.remove('error-border');
        currentNomeInput.classList.remove('error-border');
        return false;
    }

    const currentKey = `${currentMatricula}_${currentNome.toLowerCase()}`;
    let isDuplicated = false;

    rows.forEach(r => {
        r.querySelector('input[name="matriculas[]"]').classList.remove('error-border');
        r.querySelector('input[name="transportados[]"]').classList.remove('error-border');
    });
    rows.forEach(rowToCheck => {
        if (rowToCheck === row) return;
        const rowMatricula = rowToCheck.querySelector('input[name="matriculas[]"]').value.trim();
        const rowNome = rowToCheck.querySelector('input[name="transportados[]"]').value.trim();
        const rowKey = `${rowMatricula}_${rowNome.toLowerCase()}`;
        if (rowKey === currentKey) {
            isDuplicated = true;
            rowToCheck.querySelector('input[name="matriculas[]"]').classList.add('error-border');
            rowToCheck.querySelector('input[name="transportados[]"]').classList.add('error-border');
        }
    });
    if (isDuplicated) {
        currentMatriculaInput.classList.add('error-border');
        currentNomeInput.classList.add('error-border');
        showWarning(`Passageiro duplicado encontrado: Matrícula ${currentMatricula} e Nome ${currentNome}.`);
    }

    return isDuplicated;
}

function handleAutofillDynamic(sourceInput, targetInput, sourceType) {
    const value = sourceInput.value.trim();
    if (value !== '') {
        let targetValue = '';
        if (sourceType === 'matricula') {
            targetValue = matriculaToNome[value];
        } else if (sourceType === 'nome') {
            targetValue = nomeToMatricula[value.toLowerCase()];
        }

        if (targetValue) {
            targetInput.value = targetValue;
            targetInput.classList.remove('error-border');
        } else {
            targetInput.value = '';
        }
    } else {
        targetInput.value = '';
    }
    setTimeout(() => checkPassageiroDuplicidade(sourceInput), 50);
}

function updateDynamicLabels(containerId, inputName, baseLabel) {
    const rows = document.querySelectorAll(`#${containerId} .dynamic-row`);
    rows.forEach((row, index) => {
        const pNum = index + 1;
        const label = row.querySelector('label');
        const input = row.querySelector('input');

        if (label) {
            label.textContent = index === 0 ? baseLabel + ':' : `${baseLabel} (P${pNum}):`;
        }

        if (containerId === 'solicitante-campos-container' && index === 0 && input) {
            input.id = 'solicitante';
            input.name = 'solicitantes[]';
        }

        if (containerId === 'destino-campos-container' && index === 0) {
            const destinoInput = row.querySelector('input[name="destinos[]"]');
            if (destinoInput) destinoInput.id = 'destino';
            const chegadaInput = row.querySelector('input[name="chegadas_destino[]"]');
            if (chegadaInput) chegadaInput.id = 'chegada_destino_p1';
        }

        if (containerId === 'valor-campos-container') {
            const valorInput = row.querySelector('input[name="valores[]"]');
            const valorExtraInput = row.querySelector('input[name="valores_extra[]"]');

            if (valorInput) {
                valorInput.id = index === 0 ? 'valor' : `valor-${pNum}`;
                valorInput.classList.remove('error-border');
                valorInput.addEventListener('input', () => formatCurrencyInput(valorInput));
                valorInput.addEventListener('focus', () => { if (valorInput.value === '0,00') valorInput.value = ''; });
                valorInput.addEventListener('blur', () => { if (valorInput.value === '') valorInput.value = '0,00'; });
                if (valorInput.value === '') valorInput.value = '0,00';
            }

            if (valorExtraInput) {
                valorExtraInput.id = index === 0 ? 'valor-extra' : `valor-extra-${pNum}`;
                valorExtraInput.classList.remove('error-border');
                valorExtraInput.addEventListener('input', () => formatCurrencyInput(valorExtraInput));
                valorExtraInput.addEventListener('focus', () => { if (valorExtraInput.value === '0,00') valorExtraInput.value = ''; });
                valorExtraInput.addEventListener('blur', () => { if (valorExtraInput.value === '') valorExtraInput.value = '0,00'; });
                if (valorExtraInput.value === '') valorExtraInput.value = '0,00';
            }
        }

        const removeBtn = row.querySelector('.remove-dynamic-btn');
        if (removeBtn) {
            removeBtn.style.display = index === 0 ? 'none' : 'block';
            removeBtn.onclick = () => {
                row.remove();
                updateDynamicLabels(containerId, inputName, baseLabel);
            };
        }
    });
}

function createSolicitanteInput(index, isRequired = true) {
    const fieldset = document.createElement('div');
    fieldset.className = 'dynamic-row form-row-align';
    const pNum = document.querySelectorAll('#solicitante-campos-container .dynamic-row').length + 1;
    const labelText = isRequired ? 'Solicitante:' : `Solicitante (P${pNum}):`;
    fieldset.innerHTML = `
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">${labelText}</label>
            <input type="text" name="solicitantes[]" onfocus="this.classList.remove('error-border')" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
        </div>
        <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-dynamic-btn" style="display: ${isRequired ? 'none' : 'block'};">-</button>
    `;
    return fieldset;
}

function createDestinoInput(index, isRequired = true) {
    const fieldset = document.createElement('div');
    fieldset.className = 'dynamic-row grid grid-cols-2 gap-4 md:gap-6';
    const pNum = document.querySelectorAll('#destino-campos-container .dynamic-row').length + 1;
    const labelText = isRequired ? 'Destino:' : `Destino (P${pNum}):`;
    const labelTime = isRequired ? 'Chegada (Horário):' : `Chegada (P${pNum}):`;
    fieldset.innerHTML = `
        <div class="form-row-align">
            <div class="flex-grow">
                <label class="block text-sm font-medium text-gray-700">${labelText}</label>
                <input type="text" name="destinos[]" onfocus="this.classList.remove('error-border')" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
            </div>
            <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-dynamic-btn" style="display: ${isRequired ? 'none' : 'block'};">-</button>
        </div>
        <div class="form-row-align">
            <div class="flex-grow">
                <label class="block text-sm font-medium text-gray-700">${labelTime}</label>
                <input type="time" name="chegadas_destino[]" onfocus="this.classList.remove('error-border')" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
            </div>
        </div>
    `;
    return fieldset;
}

function createValorInput(pNum, isRequired = true) {
    const fieldset = document.createElement('div');
    fieldset.className = 'dynamic-row grid grid-cols-2 gap-4 md:gap-6 valor-row';
    const labelValor = pNum === 1 ? 'Valor P1:' : `Valor P${pNum}:`;
    const labelValorExtra = pNum === 1 ? 'Valor Extra P1:' : `Valor Extra P${pNum}:`;
    fieldset.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">${labelValor}</label>
            <div class="relative mt-1">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 pr-2 text-gray-400">R$</span>
                <input type="text" name="valores[]" class="block w-full px-3 py-2 pl-9 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-right">
            </div>
        </div>
        <div class="form-row-align">
            <div class="flex-grow">
                <label class="block text-sm font-medium text-gray-700">${labelValorExtra}</label>
                <div class="relative mt-1">
                    <span class="absolute inset-y-0 left-0 flex items-center pl-3 pr-2 text-gray-400">R$</span>
                    <input type="text" name="valores_extra[]" class="block w-full px-3 py-2 pl-9 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out text-right">
                </div>
            </div>
            <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-valor-btn" style="display: ${pNum === 1 ? 'none' : 'block'};">-</button>
        </div>
    `;
    fieldset.querySelector('.remove-valor-btn').onclick = () => fieldset.remove();
    return fieldset;
}

function addDynamicRow(containerId, inputName, baseLabel, isRequired = false) {
    const container = document.getElementById(containerId);
    let newRow;
    const index = Date.now();
    const pNum = container.querySelectorAll('.dynamic-row').length + 1;

    if (inputName === 'solicitante') {
        newRow = createSolicitanteInput(index, isRequired);
    } else if (inputName === 'destino') {
        newRow = createDestinoInput(index, isRequired);
    } else if (inputName === 'valor') {
        newRow = createValorInput(pNum, isRequired);
    }

    if (newRow) {
        container.appendChild(newRow);
        updateDynamicLabels(containerId, inputName, baseLabel);
    }
}

function createPassageiroInput(index, isRequired = true) {
    const fieldset = document.createElement('div');
    fieldset.className = 'passageiro-row grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6';
    fieldset.innerHTML = `
        <div>
            <label for="matricula-${index}" class="block text-sm font-medium text-gray-700">Matrícula (P${index + 1}):</label>
            <input type="text" id="matricula-${index}" name="matriculas[]" list="transportados-matricula-list" onfocus="this.classList.remove('error-border')" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
        </div>
        <div class="flex items-end">
            <div class="flex-grow">
                <label for="transportado-${index}" class="block text-sm font-medium text-gray-700">Transportado (P${index + 1}):</label>
                <input type="text" id="transportado-${index}" name="transportados[]" list="transportados-nome-list" onfocus="this.classList.remove('error-border')" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out">
            </div>
            <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-passageiro-btn" style="display: ${isRequired ? 'none' : 'block'};">-</button>
        </div>
    `;
    fieldset.querySelector('.remove-passageiro-btn').onclick = () => {
        fieldset.remove();
        updatePassageiroLabels();
    };
    return fieldset;
}

function updatePassageiroLabels() {
    const rows = document.querySelectorAll('#passageiros-campos-container .passageiro-row');
    rows.forEach((row, index) => {
        const pNum = index + 1;
        row.querySelector(`label[for^="matricula-"]`).textContent = `Matrícula (P${pNum}):`;
        row.querySelector(`label[for^="transportado-"]`).textContent = `Transportado (P${pNum}):`;
    });
}

function addPassageiroRow(isRequired = false) {
    const pNum = passageirosContainer.querySelectorAll('.passageiro-row').length;
    const newRow = createPassageiroInput(pNum, isRequired);
    passageirosContainer.appendChild(newRow);
    updatePassageiroLabels();
}

// --- Inicialização e Eventos Globais ---
window.onload = () => {
    function bindPassageiroListeners() {
        passageirosContainer.addEventListener('blur', (event) => {
            const input = event.target;
            if (input.matches('input[name="matriculas[]"]') || input.matches('input[name="transportados[]"]')) {
                const row = input.closest('.passageiro-row');
                const matriculaInput = row.querySelector('input[name="matriculas[]"]');
                const nomeInput = row.querySelector('input[name="transportados[]"]');
                if (input.name === 'matriculas[]') {
                    handleAutofillDynamic(matriculaInput, nomeInput, 'matricula');
                } else {
                    handleAutofillDynamic(nomeInput, matriculaInput, 'nome');
                }
            }
        }, true);
    }

    addDynamicRow('solicitante-campos-container', 'solicitante', 'Solicitante', true);
    addDynamicRow('destino-campos-container', 'destino', 'Destino', true);
    addDynamicRow('valor-campos-container', 'valor', 'Valor', true);
    addPassageiroRow(true);

    bindPassageiroListeners();
    addPassageiroBtn.addEventListener('click', () => addPassageiroRow(false));
    addSolicitanteBtn.addEventListener('click', () => addDynamicRow('solicitante-campos-container', 'solicitante', 'Solicitante', false));
    addDestinoBtn.addEventListener('click', () => addDynamicRow('destino-campos-container', 'destino', 'Destino', false));
    addValorBtn.addEventListener('click', () => addDynamicRow('valor-campos-container', 'valor', 'Valor', false));

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            startFirestoreListeners();
        } else {
            loginPage.classList.remove('hidden');
            appPage.classList.add('hidden');
        }
    });
    signInAnonymously(auth).catch((error) => console.error("Erro no login anônimo:", error));
};

loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const foundUser = users.find(user => user.username === username && user.password === password);
    if (foundUser) {
        loginPage.classList.add('hidden');
        appPage.classList.remove('hidden');
        setMotoristaReadOnly(username);
    } else {
        loginMessage.classList.remove('hidden');
    }
});

logoutButton.addEventListener('click', () => {
    signOut(auth).then(() => window.location.reload());
});

function startFirestoreListeners() {
    onSnapshot(collection(db, 'artifacts', globalAppId, 'public', 'data', 'transportados'), (snapshot) => {
        transportadosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        rebuildTransportadosLookups();
    });
    onSnapshot(collection(db, 'artifacts', globalAppId, 'public', 'data', 'motoristas'), (snapshot) => {
        motoristasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        rebuildMotoristasLookups();
    });
    onSnapshot(collection(db, 'artifacts', globalAppId, 'public', 'data', 'lancamentos'), (snapshot) => {
        lancamentosData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    });
}

function rebuildTransportadosLookups(sortKey = 'nome', sortOrder = 'asc') {
    transportadosData.sort((a, b) => {
        const valA = a[sortKey] || '';
        const valB = b[sortKey] || '';
        return sortOrder === 'asc' ? valA.localeCompare(valB, undefined, { numeric: true }) : valB.localeCompare(valA, undefined, { numeric: true });
    });
    matriculaToNome = Object.fromEntries(transportadosData.map(item => [item.matricula, item.nome]));
    nomeToMatricula = Object.fromEntries(transportadosData.map(item => [item.nome.toLowerCase(), item.matricula]));
    renderTransportadosList();
}

function rebuildMotoristasLookups(sortOrder = 'asc') {
    motoristasData.sort((a, b) => sortOrder === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome));
    renderMotoristasList();
    populateMotoristasDatalist();
}

function formatCurrencyInput(input) {
    if (!input) return;
    let value = input.value.replace(/\D/g, '').padStart(3, '0');
    const integerPart = value.slice(0, -2);
    const decimalPart = value.slice(-2);
    input.value = `${parseInt(integerPart, 10).toLocaleString('pt-BR')},${decimalPart}`;
}

function parseCurrencyValue(value) {
    if (typeof value !== 'string' || value.trim() === '') return 0;
    return parseFloat(value.replace(/\./g, '').replace(',', '.'));
}

document.getElementById('form-corrida').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = event.target;
    let isFormValid = true;
    const requiredFields = ['motorista', 'data', 'origem', 'partida'];
    requiredFields.forEach(fieldId => {
        const input = form[fieldId];
        if (input && input.value.trim() === '') {
            isFormValid = false;
            input.classList.add('error-border');
        } else if (input) {
            input.classList.remove('error-border');
        }
    });

    const getDynamicData = (containerId, name) => Array.from(document.querySelectorAll(`#${containerId} input[name="${name}[]"]`)).map(input => input.value.trim()).filter(Boolean);

    const solicitantesData = getDynamicData('solicitante-campos-container', 'solicitantes');
    const destinosData = getDynamicData('destino-campos-container', 'destinos');
    const chegadasDestinoData = getDynamicData('destino-campos-container', 'chegadas_destino');
    const valoresData = Array.from(document.querySelectorAll('#valor-campos-container input[name="valores[]"]')).map(input => parseCurrencyValue(input.value));
    const valoresExtraData = Array.from(document.querySelectorAll('#valor-campos-container input[name="valores_extra[]"]')).map(input => parseCurrencyValue(input.value));
    
    const passageirosData = [];
    const passageirosRows = document.querySelectorAll('#passageiros-campos-container .passageiro-row');
    passageirosRows.forEach(row => {
        const matricula = row.querySelector('input[name="matriculas[]"]').value.trim();
        const nome = row.querySelector('input[name="transportados[]"]').value.trim();
        if (matricula && nome) passageirosData.push({ matricula, nome });
    });

    if (solicitantesData.length === 0 || destinosData.length === 0 || passageirosData.length === 0 || destinosData.length !== chegadasDestinoData.length) {
        isFormValid = false;
    }

    if (!isFormValid) {
        showWarning('Preencha todos os campos obrigatórios e verifique se todos os destinos possuem chegada.');
        return;
    }

    const newEntry = {
        userId: globalUserId,
        createdBy: currentUser.username,
        motorista: form.motorista.value,
        data: form.data.value,
        origem: form.origem.value,
        partida: form.partida.value,
        observacao: form.observacao.value,
        createdAt: serverTimestamp(),
        solicitante: solicitantesData[0],
        solicitantes_extras: solicitantesData.slice(1),
        matricula: passageirosData[0].matricula,
        transportado: passageirosData[0].nome,
        passageiros_extras: passageirosData.slice(1),
        destino: destinosData[0],
        chegada_destino: chegadasDestinoData[0],
        valor: valoresData[0] || 0,
        valorExtra: valoresExtraData[0] || 0,
        destinos_extras: destinosData.slice(1).map((destino, i) => ({
            destino,
            chegada: chegadasDestinoData[i + 1],
            valor: valoresData[i + 1] || 0,
            valorExtra: valoresExtraData[i + 1] || 0
        }))
    };

    await addDoc(collection(db, 'artifacts', globalAppId, 'public', 'data', 'lancamentos'), newEntry);
    showWarning('Lançamento salvo com sucesso!');
    form.reset();
    ['solicitante-campos-container', 'destino-campos-container', 'valor-campos-container', 'passageiros-campos-container'].forEach(id => document.getElementById(id).innerHTML = '');
    addDynamicRow('solicitante-campos-container', 'solicitante', 'Solicitante', true);
    addDynamicRow('destino-campos-container', 'destino', 'Destino', true);
    addDynamicRow('valor-campos-container', 'valor', 'Valor', true);
    addPassageiroRow(true);
});

// =========================================================================
// CÓDIGO DOS RELATÓRIOS CSV (CORRIGIDO)
// =========================================================================
function downloadCSV(detailed = true) {
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        showWarning('A data de início não pode ser posterior à data de fim.');
        return;
    }

    let dataToDownload = lancamentosData.filter(item => {
        if (!currentUser.isAdmin && item.userId !== globalUserId) return false;
        if (!startDate && !endDate) return true;
        const itemDate = new Date(item.data);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        return (!start || itemDate >= start) && (!end || itemDate <= end);
    });

    if (dataToDownload.length === 0) {
        showWarning('Nenhum dado encontrado para este período/permissão.');
        return;
    }

    const bom = '\uFEFF';
    const maxExtras = 3;

    let csvHeaders = detailed ? 
        ['DATA', 'MOTORISTA', 'SOLICITANTE P1', 'PASSAGEIRO P1', 'VALOR NORMAL P1', 'VALOR EXTRA P1', 'ORIGEM', 'PARTIDA', 'DESTINO P1', 'CHEGADA P1'] :
        ['DATA', 'SOLICITANTE P1', 'PASSAGEIRO P1', 'VALOR NORMAL P1', 'VALOR EXTRA P1'];

    const extraHeaders = [];
    for (let i = 1; i <= maxExtras; i++) {
        const pNum = i + 1;
        const baseExtra = [`SOLICITANTE EXTRA ${i}`, `PASSAGEIRO EXTRA ${i}`, `VALOR NORMAL P${pNum}`, `VALOR EXTRA P${pNum}`];
        extraHeaders.push(...baseExtra);
    }
    if (detailed) extraHeaders.push('OBSERVAÇÃO');
    const finalHeaders = [...csvHeaders, ...extraHeaders];

    const rows = dataToDownload.map(obj => {
        const solicitantes = [obj.solicitante || '', ...(obj.solicitantes_extras || [])];
        const passageiros = [{ nome: obj.transportado || '' }, ...(obj.passageiros_extras || [])];
        const destinosValores = [{
            destino: obj.destino || '',
            chegada: obj.chegada_destino || '',
            valor: obj.valor || 0,
            valorExtra: obj.valorExtra || 0,
        }, ...(obj.destinos_extras || [])];

        let rowData = [
            obj.data || '',
        ];

        if (detailed) rowData.push(obj.motorista || '');

        rowData.push(
            solicitantes[0] || '',
            passageiros[0].nome || '',
            (destinosValores[0].valor || 0).toFixed(2).replace('.', ','),
            (destinosValores[0].valorExtra || 0).toFixed(2).replace('.', ',')
        );

        if (detailed) {
            rowData.push(
                obj.origem || '',
                obj.partida || '',
                destinosValores[0].destino || '',
                destinosValores[0].chegada || ''
            );
        }

        const extraData = [];
        for (let i = 1; i <= maxExtras; i++) {
            const solicitanteExtra = solicitantes[i] || '';
            const passageiroExtraNome = (passageiros[i] && passageiros[i].nome) ? passageiros[i].nome : '';
            const destinoValorObj = destinosValores[i] || { valor: 0, valorExtra: 0 };
            const valorNormal_Pn = (destinoValorObj.valor || 0).toFixed(2).replace('.', ',');
            const valorExtra_Pn = (destinoValorObj.valorExtra || 0).toFixed(2).replace('.', ',');
            
            extraData.push(solicitanteExtra, passageiroExtraNome, valorNormal_Pn, valorExtra_Pn);
        }
        if (detailed) extraData.push(obj.observacao || '');

        return [...rowData, ...extraData].map(value => `"${String(value).replace(/"/g, '""')}"`).join(';');
    }).join('\n');

    const csvContent = `${finalHeaders.join(';')}\n${rows}`;
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lancamentos_${detailed ? 'detalhado' : 'simples'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.getElementById('download-csv').addEventListener('click', () => downloadCSV(true));
document.getElementById('download-csv-custom').addEventListener('click', () => downloadCSV(false));

// =========================================================================
// LÓGICA DOS MODAIS
// =========================================================================

function formatMultipleValues(principal, extras, isPassageiro = false) {
    let result = principal || '';
    if (extras && extras.length > 0) {
        const extraList = extras.map(e => isPassageiro ? e.nome : e);
        if (extraList.some(Boolean)) result += ` (${extraList.filter(Boolean).join(', ')})`;
    }
    return result;
}

function formatDestinosChegadas(principalDestino, principalChegada, extras) {
    let result = principalDestino || '';
    if (principalChegada) result += ` (${principalChegada})`;

    if (extras && extras.length > 0) {
        const extraList = extras.map(e => `${e.destino || ''}${e.chegada ? ` (${e.chegada})` : ''}`).filter(Boolean);
        if (extraList.length > 0) result += ` (${extraList.join(', ')})`;
    }
    return result;
}

const calculateTotal = (lancamento, key) => (lancamento[key] || 0) + (lancamento.destinos_extras || []).reduce((acc, dest) => acc + (dest[key] || 0), 0);
const calculateTotalValue = (lancamento) => calculateTotal(lancamento, 'valor');
const calculateTotalExtraValue = (lancamento) => calculateTotal(lancamento, 'valorExtra');

function renderLancamentosList() {
    const tableBody = document.querySelector('#lancamentos-table tbody');
    tableBody.innerHTML = '';
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;

    let dataToShow = lancamentosData.filter(item => {
        if (!currentUser.isAdmin && item.userId !== globalUserId) return false;
        if (!startDate && !endDate) return true;
        const itemDate = new Date(item.data + "T00:00:00");
        const start = startDate ? new Date(startDate + "T00:00:00") : null;
        const end = endDate ? new Date(endDate + "T00:00:00") : null;
        return (!start || itemDate >= start) && (!end || itemDate <= end);
    }).sort((a, b) => new Date(b.data) - new Date(a.data));

    if (dataToShow.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="13" class="text-center p-4">Nenhum lançamento encontrado.</td></tr>';
        return;
    }

    dataToShow.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'bg-white hover:bg-gray-50';
        row.innerHTML = `
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden">${item.id || ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.data || ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.motorista || ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatMultipleValues(item.solicitante, item.solicitantes_extras, false)}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatMultipleValues(item.transportado, item.passageiros_extras, true)}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.origem || ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${formatDestinosChegadas(item.destino, item.chegada_destino, item.destinos_extras)}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.partida || ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">R$ ${calculateTotalValue(item).toFixed(2).replace('.', ',')}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">R$ ${calculateTotalExtraValue(item).toFixed(2).replace('.', ',')}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.observacao || ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${item.editedBy ? `<span class="text-xs text-gray-500">Editado por ${item.editedBy}</span>` : ''}</td>
           <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <button data-id="${item.id}" class="edit-lancamento-btn text-blue-600 hover:text-blue-900">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

document.getElementById('open-lancamentos-modal').addEventListener('click', () => {
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    renderLancamentosList();
    document.getElementById('lancamentos-modal').classList.remove('hidden');
});
document.getElementById('close-lancamentos-modal').addEventListener('click', () => document.getElementById('lancamentos-modal').classList.add('hidden'));
document.getElementById('filter-lancamentos-btn').addEventListener('click', renderLancamentosList);

document.getElementById('lancamentos-table').addEventListener('click', (event) => {
    const editButton = event.target.closest('.edit-lancamento-btn');
    if (editButton) openEditLancamentoModal(editButton.dataset.id);
});

function createEditDynamicInput(containerId, inputName, baseLabel, value = '') {
    const fieldset = document.createElement('div');
    fieldset.className = 'edit-dynamic-row form-row-align';
    const pNum = document.querySelectorAll(`#${containerId} .edit-dynamic-row`).length + 1;
    fieldset.innerHTML = `
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">${baseLabel} (P${pNum}):</label>
            <input type="text" name="edit-${inputName}s[]" value="${value}" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
        </div>
        <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-edit-dynamic-btn">-</button>
    `;
    fieldset.querySelector('.remove-edit-dynamic-btn').onclick = () => fieldset.remove();
    return fieldset;
}

function createEditDestinoChegadaInput(destino = '', chegada = '') {
    const pNum = document.querySelectorAll('#edit-destino-campos-container .edit-dynamic-row').length + 1;
    const fieldset = document.createElement('div');
    fieldset.className = 'edit-dynamic-row grid grid-cols-2 gap-4';
    fieldset.innerHTML = `
        <div class="form-row-align">
            <div class="flex-grow">
                <label class="block text-sm font-medium text-gray-700">Destino (P${pNum}):</label>
                <input type="text" name="edit-destinos[]" value="${destino}" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
            </div>
            <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-edit-dynamic-btn">-</button>
        </div>
        <div class="form-row-align">
            <div class="flex-grow">
                <label class="block text-sm font-medium text-gray-700">Chegada (P${pNum}):</label>
                <input type="time" name="edit-chegadas_destino[]" value="${chegada}" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
            </div>
        </div>
    `;
    fieldset.querySelector('.remove-edit-dynamic-btn').onclick = () => fieldset.remove();
    return fieldset;
}

function createEditValorInput(pNum, valor = '0,00', valorExtra = '0,00') {
    const fieldset = document.createElement('div');
    fieldset.className = 'edit-dynamic-row grid grid-cols-2 gap-4 valor-row';
    fieldset.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Valor P${pNum}:</label>
            <div class="relative mt-1">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 pr-2 text-gray-400">R$</span>
                <input type="text" name="edit-valores[]" value="${valor}" class="block w-full px-3 py-2 pl-9 bg-gray-50 border border-gray-300 rounded-lg text-right">
            </div>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Valor Extra P${pNum}:</label>
            <div class="relative mt-1">
                <span class="absolute inset-y-0 left-0 flex items-center pl-3 pr-2 text-gray-400">R$</span>
                <input type="text" name="edit-valores_extra[]" value="${valorExtra}" class="block w-full px-3 py-2 pl-9 bg-gray-50 border border-gray-300 rounded-lg text-right">
            </div>
        </div>
    `;
    const valorInput = fieldset.querySelector('input[name="edit-valores[]"]');
    const valorExtraInput = fieldset.querySelector('input[name="edit-valores_extra[]"]');
    [valorInput, valorExtraInput].forEach(input => {
        input.addEventListener('input', () => formatCurrencyInput(input));
        input.addEventListener('blur', () => { if (input.value === '') input.value = '0,00'; });
    });
    return fieldset;
}

function addEditDynamicRow(containerId, type, ...values) {
    const container = document.getElementById(containerId);
    let newRow;
    if (type === 'solicitante') newRow = createEditDynamicInput(containerId, 'solicitante', 'Solicitante', values[0] || '');
    else if (type === 'destino') newRow = createEditDestinoChegadaInput(values[0] || '', values[1] || '');
    else if (type === 'valor') {
        const pNum = container.querySelectorAll('.edit-dynamic-row').length + 1;
        newRow = createEditValorInput(pNum, (values[0] || 0).toFixed(2).replace('.', ','), (values[1] || 0).toFixed(2).replace('.', ','));
    }
    if (newRow) container.appendChild(newRow);
}

document.getElementById('add-edit-solicitante-btn').addEventListener('click', () => addEditDynamicRow('edit-solicitante-campos-container', 'solicitante'));
document.getElementById('add-edit-destino-btn').addEventListener('click', () => addEditDynamicRow('edit-destino-campos-container', 'destino'));
document.getElementById('add-edit-valor-btn').addEventListener('click', () => addEditDynamicRow('edit-valor-campos-container', 'valor'));

function createEditPassageiroInput(pNum, matricula = '', nome = '') {
    const fieldset = document.createElement('div');
    fieldset.className = 'edit-passageiro-row grid grid-cols-1 md:grid-cols-2 gap-4';
    fieldset.innerHTML = `
        <div>
            <label class="block text-sm font-medium text-gray-700">Matrícula (P${pNum}):</label>
            <input type="text" name="edit-matriculas[]" list="transportados-matricula-list" value="${matricula}" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
        </div>
        <div class="flex items-end">
            <div class="flex-grow">
                <label class="block text-sm font-medium text-gray-700">Transportado (P${pNum}):</label>
                <input type="text" name="edit-transportados[]" list="transportados-nome-list" value="${nome}" class="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg">
            </div>
            <button type="button" class="ml-2 px-3 py-2 bg-gray-300 text-gray-800 font-bold rounded-lg shadow-md hover:bg-gray-400 remove-edit-passageiro-btn">-</button>
        </div>
    `;
    const matriculaInput = fieldset.querySelector('input[name="edit-matriculas[]"]');
    const nomeInput = fieldset.querySelector('input[name="edit-transportados[]"]');
    matriculaInput.addEventListener('blur', () => handleAutofillDynamic(matriculaInput, nomeInput, 'matricula'));
    nomeInput.addEventListener('blur', () => handleAutofillDynamic(nomeInput, matriculaInput, 'nome'));
    fieldset.querySelector('.remove-edit-passageiro-btn').onclick = () => fieldset.remove();
    return fieldset;
}

function addEditPassageiroRow(matricula = '', nome = '') {
    const container = document.getElementById('edit-passageiros-extras-container');
    const pNum = container.querySelectorAll('.edit-passageiro-row').length + 2;
    container.appendChild(createEditPassageiroInput(pNum, matricula, nome));
}

document.getElementById('add-edit-passageiro-btn').addEventListener('click', () => addEditPassageiroRow());

function openEditLancamentoModal(id) {
    const lancamento = lancamentosData.find(l => l.id === id);
    if (!lancamento) return;

    const form = document.getElementById('edit-lancamento-form');
    form.reset();
    ['edit-solicitante-campos-container', 'edit-passageiros-extras-container', 'edit-destino-campos-container', 'edit-valor-campos-container'].forEach(id => document.getElementById(id).innerHTML = '');

    document.getElementById('edit-lancamento-id').value = id;
    document.getElementById('edit-data').value = lancamento.data;
    document.getElementById('edit-origem').value = lancamento.origem;
    document.getElementById('edit-observacao').value = lancamento.observacao || '';
    document.getElementById('edit-partida').value = lancamento.partida || '';
    
    const motoristaInput = document.getElementById('edit-motorista');
    motoristaInput.value = lancamento.motorista;
    motoristaInput.readOnly = !currentUser.isAdmin;
    motoristaInput.classList.toggle('bg-gray-200', !currentUser.isAdmin);

    addEditDynamicRow('edit-solicitante-campos-container', 'solicitante', lancamento.solicitante);
    (lancamento.solicitantes_extras || []).forEach(s => addEditDynamicRow('edit-solicitante-campos-container', 'solicitante', s));
    
    document.getElementById('edit-matricula').value = lancamento.matricula || '';
    document.getElementById('edit-transportado').value = lancamento.transportado || '';
    (lancamento.passageiros_extras || []).forEach(p => addEditPassageiroRow(p.matricula, p.nome));

    const destinos = [{ destino: lancamento.destino, chegada: lancamento.chegada_destino }, ...(lancamento.destinos_extras || [])];
    const valores = [{ valor: lancamento.valor, valorExtra: lancamento.valorExtra }, ...(lancamento.destinos_extras || []).map(d => ({ valor: d.valor, valorExtra: d.valorExtra }))];
    
    destinos.forEach(d => addEditDynamicRow('edit-destino-campos-container', 'destino', d.destino, d.chegada));
    valores.forEach(v => addEditDynamicRow('edit-valor-campos-container', 'valor', v.valor, v.valorExtra));

    document.getElementById('edit-lancamento-modal').classList.remove('hidden');
}

function setupEditModalAutofill() {
    const modal = document.getElementById('edit-lancamento-modal');
    modal.addEventListener('blur', (event) => {
        const input = event.target;
        const parentDiv = input.closest('.grid.grid-cols-1.md\\:grid-cols-2.gap-4') || input.closest('.edit-passageiro-row');
        if (!parentDiv) return;

        const matriculaInput = parentDiv.querySelector('input[name="edit-matriculas[]"]');
        const nomeInput = parentDiv.querySelector('input[name="edit-transportados[]"]');
        if (matriculaInput && nomeInput) {
            if (input === matriculaInput) handleAutofillDynamic(matriculaInput, nomeInput, 'matricula');
            else if (input === nomeInput) handleAutofillDynamic(nomeInput, matriculaInput, 'nome');
        }
    }, true);
}
setupEditModalAutofill();

document.getElementById('close-edit-lancamento-modal').addEventListener('click', () => document.getElementById('edit-lancamento-modal').classList.add('hidden'));
document.getElementById('cancel-edit-btn').addEventListener('click', () => document.getElementById('edit-lancamento-modal').classList.add('hidden'));

// =========================================================================
// INÍCIO DO CÓDIGO DE EDIÇÃO CORRIGIDO
// =========================================================================
document.getElementById('edit-lancamento-form').addEventListener('submit', async function (event) {
    event.preventDefault();
    const id = document.getElementById('edit-lancamento-id').value;

    // --- LÓGICA DE COLETA E VALIDAÇÃO ---

    // Coleta de Solicitantes
    const solicitantesEdit = Array.from(document.querySelectorAll('#edit-solicitante-campos-container input[name="edit-solicitantes[]"]'))
        .map(input => input.value.trim())
        .filter(value => value !== '');
    if (solicitantesEdit.length === 0) {
        showWarning('O solicitante principal (P1) deve estar preenchido.');
        return;
    }

    // Coleta de Passageiros
    const p1Matricula = document.getElementById('edit-matricula').value.trim();
    const p1Nome = document.getElementById('edit-transportado').value.trim();
    if (!p1Matricula || !p1Nome) {
        showWarning('O passageiro principal (P1) deve ter matrícula e nome preenchidos.');
        return;
    }
    const matriculasExtras = Array.from(document.querySelectorAll('#edit-passageiros-extras-container input[name="edit-matriculas[]"]')).map(input => input.value.trim());
    const nomesExtras = Array.from(document.querySelectorAll('#edit-passageiros-extras-container input[name="edit-transportados[]"]')).map(input => input.value.trim());
    const passageirosExtras = matriculasExtras.map((matricula, i) => ({
        matricula: matricula,
        nome: nomesExtras[i]
    })).filter(p => p.matricula && p.nome);

    
    // --- LÓGICA CORRIGIDA PARA DESTINOS E VALORES ---

    // 1. Coletar todos os destinos e valores em arrays separados
    const destinosInputs = document.querySelectorAll('#edit-destino-campos-container input[name="edit-destinos[]"]');
    const chegadasInputs = document.querySelectorAll('#edit-destino-campos-container input[name="edit-chegadas_destino[]"]');
    const valoresInputs = document.querySelectorAll('#edit-valor-campos-container input[name="edit-valores[]"]');
    const valoresExtraInputs = document.querySelectorAll('#edit-valor-campos-container input[name="edit-valores_extra[]"]');

    const destinosArray = [];
    let destinoIncompleto = false;
    destinosInputs.forEach((destinoInput, i) => {
        const destino = destinoInput.value.trim();
        const chegada = chegadasInputs[i] ? chegadasInputs[i].value.trim() : '';
        if ((destino && !chegada) || (!destino && chegada)) {
            destinoIncompleto = true;
        }
        destinosArray.push({ destino, chegada });
    });

    if (destinoIncompleto) {
        showWarning('Preencha os campos de Destino e Chegada (Horário) ou deixe ambos vazios.');
        return;
    }
    
    if (!destinosArray[0] || !destinosArray[0].destino || !destinosArray[0].chegada) {
        showWarning('O destino principal (P1) e sua chegada devem estar preenchidos.');
        return;
    }

    const valoresArray = [];
    valoresInputs.forEach((valorInput, i) => {
        const valor = parseCurrencyValue(valorInput.value);
        const valorExtra = valoresExtraInputs[i] ? parseCurrencyValue(valoresExtraInputs[i].value) : 0;
        valoresArray.push({ valor, valorExtra });
    });

    // 2. Construir o objeto de dados atualizado
    const updatedData = {
        motorista: document.getElementById('edit-motorista').value,
        data: document.getElementById('edit-data').value,
        partida: document.getElementById('edit-partida').value,
        origem: document.getElementById('edit-origem').value,
        observacao: document.getElementById('edit-observacao').value,
        editedBy: currentUser.username,
        editedAt: serverTimestamp(),

        solicitante: solicitantesEdit[0],
        matricula: p1Matricula,
        transportado: p1Nome,
        destino: destinosArray[0].destino,
        chegada_destino: destinosArray[0].chegada,
        valor: valoresArray[0] ? valoresArray[0].valor : 0,
        valorExtra: valoresArray[0] ? valoresArray[0].valorExtra : 0,

        solicitantes_extras: solicitantesEdit.slice(1),
        passageiros_extras: passageirosExtras,
        destinos_extras: [],
    };

    // 3. Combinar os arrays de destinos e valores para criar os 'destinos_extras'
    const totalItens = Math.max(destinosArray.length, valoresArray.length);

    for (let i = 1; i < totalItens; i++) {
        const destinoInfo = destinosArray[i] || { destino: '', chegada: '' };
        const valorInfo = valoresArray[i] || { valor: 0, valorExtra: 0 };

        if (destinoInfo.destino || valorInfo.valor > 0 || valorInfo.valorExtra > 0) {
            updatedData.destinos_extras.push({
                destino: destinoInfo.destino,
                chegada: destinoInfo.chegada,
                valor: valorInfo.valor,
                valorExtra: valorInfo.valorExtra
            });
        }
    }

    // 4. Salvar os dados no banco de dados
    const docRef = doc(db, 'artifacts', globalAppId, 'public', 'data', 'lancamentos', id);
    await updateDoc(docRef, updatedData);

    showWarning('Lançamento atualizado com sucesso!');
    document.getElementById('edit-lancamento-modal').classList.add('hidden');
    renderLancamentosList();
});
// =========================================================================
// FIM DO CÓDIGO DE EDIÇÃO CORRIGIDO
// =========================================================================


// --- Funções CRUD e Renderização dos Modais Antigos ---
function renderTransportadosList() {
    const tableBody = document.querySelector('#transportados-table tbody');
    tableBody.innerHTML = '';
    transportadosData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'bg-white hover:bg-gray-50';
        row.innerHTML = `
            <td class="p-4"><input type="checkbox" data-id="${item.id}" class="transportado-checkbox rounded-sm"></td>
            <td class="px-6 py-4">${item.matricula}</td>
            <td class="px-6 py-4">${item.nome}</td>
        `;
        tableBody.appendChild(row);
    });
    populateTransportadosDatalist();
}

function renderMotoristasList() {
    const tableBody = document.querySelector('#motoristas-table tbody');
    tableBody.innerHTML = '';
    motoristasData.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'bg-white hover:bg-gray-50';
        row.innerHTML = `
            <td class="p-4"><input type="checkbox" data-id="${item.id}" class="motorista-checkbox rounded-sm"></td>
            <td class="px-6 py-4">${item.nome}</td>
        `;
        tableBody.appendChild(row);
    });
}

function populateTransportadosDatalist() {
    const matriculaDatalist = document.getElementById('transportados-matricula-list') || document.createElement('datalist');
    matriculaDatalist.id = 'transportados-matricula-list';
    const nomeDatalist = document.getElementById('transportados-nome-list') || document.createElement('datalist');
    nomeDatalist.id = 'transportados-nome-list';
    if (!document.body.contains(matriculaDatalist)) document.body.appendChild(matriculaDatalist);
    if (!document.body.contains(nomeDatalist)) document.body.appendChild(nomeDatalist);
    
    matriculaDatalist.innerHTML = transportadosData.map(item => `<option value="${item.matricula}">`).join('');
    nomeDatalist.innerHTML = transportadosData.map(item => `<option value="${item.nome}">`).join('');
}

function populateMotoristasDatalist() {
    const datalist = document.getElementById('motoristas-list');
    datalist.innerHTML = motoristasData.map(item => `<option value="${item.nome}">`).join('');
}

document.getElementById('add-transportado').addEventListener('click', async () => {
    const newMatricula = document.getElementById('new-matricula').value.trim();
    const newNome = document.getElementById('new-nome').value.trim();
    if (newMatricula && newNome) {
        if (transportadosData.some(item => item.matricula === newMatricula || item.nome.toLowerCase() === newNome.toLowerCase())) {
            showWarning('Matrícula ou nome já existe.');
        } else {
            await addDoc(collection(db, 'artifacts', globalAppId, 'public', 'data', 'transportados'), { matricula: newMatricula, nome: newNome });
            document.getElementById('new-matricula').value = '';
            document.getElementById('new-nome').value = '';
            showWarning('Transportado adicionado.');
        }
    } else {
        showWarning('Preencha matrícula e nome.');
    }
});

document.getElementById('delete-selected-transportados').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#transportados-table .transportado-checkbox:checked');
    if (checkboxes.length === 0) return showWarning('Selecione ao menos um transportado.');
    const promises = Array.from(checkboxes).map(cb => deleteDoc(doc(db, 'artifacts', globalAppId, 'public', 'data', 'transportados', cb.dataset.id)));
    await Promise.all(promises);
    showWarning(`${checkboxes.length} transportados excluídos.`);
});

document.getElementById('add-motorista').addEventListener('click', async () => {
    const newNome = document.getElementById('new-motorista-nome').value.trim();
    if (newNome) {
        if (motoristasData.some(item => item.nome.toLowerCase() === newNome.toLowerCase())) {
            showWarning('Motorista já existe.');
        } else {
            await addDoc(collection(db, 'artifacts', globalAppId, 'public', 'data', 'motoristas'), { nome: newNome });
            document.getElementById('new-motorista-nome').value = '';
            showWarning('Motorista adicionado.');
        }
    } else {
        showWarning('Preencha o nome do motorista.');
    }
});

document.getElementById('delete-selected-motoristas').addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('#motoristas-table .motorista-checkbox:checked');
    if (checkboxes.length === 0) return showWarning('Selecione ao menos um motorista.');
    const promises = Array.from(checkboxes).map(cb => deleteDoc(doc(db, 'artifacts', globalAppId, 'public', 'data', 'motoristas', cb.dataset.id)));
    await Promise.all(promises);
    showWarning(`${checkboxes.length} motoristas excluídos.`);
});

// --- Eventos de UI restantes ---
document.getElementById('close-modal').addEventListener('click', hideWarning);
['transportados', 'motoristas'].forEach(modalName => {
    document.getElementById(`open-${modalName}-modal`).addEventListener('click', () => document.getElementById(`${modalName}-modal`).classList.remove('hidden'));
    document.getElementById(`close-${modalName}-modal`).addEventListener('click', () => document.getElementById(`${modalName}-modal`).classList.add('hidden'));
});

document.getElementById('sort-transportados-key').addEventListener('change', function () {
    rebuildTransportadosLookups(this.value, document.getElementById('sort-transportados-order').value);
});
document.getElementById('sort-transportados-order').addEventListener('change', function () {
    rebuildTransportadosLookups(document.getElementById('sort-transportados-key').value, this.value);
});
document.getElementById('sort-motoristas-order').addEventListener('change', function () {
    rebuildMotoristasLookups(this.value);
});

    </script>
</body>


</html>
