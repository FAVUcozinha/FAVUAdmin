import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const app = initializeApp({
    apiKey: "AIzaSyD5JlV7R2w629uiescD4AiixNAr-Qt0qI0",
    authDomain: "favu-app.firebaseapp.com",
    projectId: "favu-app",
    storageBucket: "favu-app.firebasestorage.app",
    messagingSenderId: "793414871188",
    appId: "1:793414871188:web:07ab447df44d742e022c81"
});

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

let globalCategories = [];
let allProducts = [];
let allEstoque = []; 
let allGastosItens = [];
let allGastosLancamentos = [];
let gastosItemAberto = null;
let gastosMesAberto = new Date().getMonth() + 1; 
let allAvisos = [];
let currentAvisosTab = 'ativos';
let currentCategoryFilter = '';

// ==========================================
// ESTADOS GLOBAIS DE PEDIDOS
// ==========================================
window.todosPedidos = [];
window.ticketsSelecionados = new Set();
window.isDragEnabled = window.innerWidth > 768; 
window.currentCalendarDate = new Date();
window.dataInicialIntervalo = null;
window.dataFinalIntervalo = null;

window.STATUS_FLOW = [
    'Pedidos Orçados',
    'Pedido Recebido',
    'Pedido Confirmado',
    'Retirada',
    'Entregue',
    'Cancelado'
];

// ==========================================
// FORMATADOR DE TEXTO 
// ==========================================
window.formatText = function(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*([\s\S]*?)\*/g, '<strong>$1</strong>')
        .replace(/_([\s\S]*?)_/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
};

// ==========================================
// REGRA RESTRITA DE ORDEM ALFABÉTICA 
// ==========================================
window.sortAlfabetico = (a, b) => {
    return (a || '').toString().localeCompare((b || '').toString(), 'pt-BR', { sensitivity: 'base' });
};

// ==========================================
// LÓGICA DE ORDENAÇÃO DE PRODUTOS
// ==========================================
const sortProducts = (a, b) => {
    const nomeA = (a.nome || '').trim().toLowerCase();
    const nomeB = (b.nome || '').trim().toLowerCase();
    if (nomeA !== nomeB) return nomeA.localeCompare(nomeB);
    const getTamPeso = (tam) => {
        if (!tam) return 99;
        const t = tam.trim().toLowerCase();
        if (t.startsWith('p')) return 1;
        if (t.startsWith('m')) return 2;
        if (t.startsWith('g')) return 3;
        if (t.startsWith('u')) return 4;
        return 99;
    };
    return getTamPeso(a.tamanho) - getTamPeso(b.tamanho);
};

// ==========================================
// FECHAR MODAIS COM ESC
// ==========================================
document.addEventListener('keydown', function(event) {
    if (event.key === "Escape") {
        document.querySelectorAll('.modal.show').forEach(m => window.closeModal(m.id));
        document.querySelectorAll('.modal-direct').forEach(m => m.style.display = 'none');
    }
});

// ==========================================
// ALERTAS E TOASTS INTELIGENTES
// ==========================================
window.customAlert = function(msg, title = "Sucesso!") {
    // Se for sucesso, não trava a tela, mostra o Toast silencioso!
    if (title === "Sucesso!" || title === "Sucesso") {
        window.showToast(msg);
        return;
    }
    // Se for erro ou aviso importante, mantém o popup
    const modal = document.getElementById('custom-alert');
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-msg').textContent = msg;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
}

window.customConfirm = function(msg, onConfirm) {
    const modal = document.getElementById('custom-confirm');
    document.getElementById('confirm-msg').textContent = msg;
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
    
    const btn = document.getElementById('confirm-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => modal.style.display = 'none', 300);
        if(onConfirm) onConfirm();
    });
}

// ==========================================
// SISTEMA DE LOGIN SEGURO (FIREBASE AUTH)
// ==========================================
window.fazerLogin = async function() {
    const email = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value.trim();
    const errorMsg = document.getElementById("login-error");
    const btn = document.querySelector("#login-screen .btn-primary");

    if (!email || !pass) {
        errorMsg.textContent = "Preencha e-mail e senha.";
        errorMsg.style.display = "block";
        return;
    }

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    btn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        errorMsg.style.display = "none";
    } catch (error) {
        console.error("Erro no login:", error);
        errorMsg.textContent = "Credenciais inválidas ou sem permissão.";
        errorMsg.style.display = "block";
    } finally {
        btn.innerHTML = 'Entrar';
        btn.disabled = false;
    }
};

window.fazerLogout = async function() {
    try {
        await signOut(auth);
        window.toggleMenu(false); 
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
};


// ==========================================
// MOSTRAR/OCULTAR SENHA
// ==========================================
window.togglePasswordVisibility = function() {
    const passInput = document.getElementById("login-pass");
    const eyeIcon = document.getElementById("eye-icon");
    if (passInput.type === "password") {
        passInput.type = "text";
        eyeIcon.classList.remove("fa-eye");
        eyeIcon.classList.add("fa-eye-slash");
    } else {
        passInput.type = "password";
        eyeIcon.classList.remove("fa-eye-slash");
        eyeIcon.classList.add("fa-eye");
    }
};

// ==========================================
// RECUPERAÇÃO DE SENHA (POPUP DEDICADO)
// ==========================================
window.abrirModalRecuperarSenha = function() {
    // Pega o e-mail que o usuário já tentou digitar na tela de login e preenche automaticamente
    const emailDigitado = document.getElementById("login-user").value.trim();
    document.getElementById("recuperar-email").value = emailDigitado;
    
    // Reseta as mensagens de erro/sucesso do popup toda vez que ele é aberto
    const msgEl = document.getElementById("recuperar-msg");
    msgEl.style.display = "none";
    msgEl.textContent = "";
    
    // Volta o botão ao estado normal
    const btn = document.getElementById("btn-enviar-recuperacao");
    btn.innerHTML = 'Enviar link de acesso';
    btn.disabled = false;
    
    window.openModal('modal-recuperar-senha');
};

window.enviarEmailRecuperacao = async function() {
    const email = document.getElementById("recuperar-email").value.trim();
    const msgEl = document.getElementById("recuperar-msg");
    const btn = document.getElementById("btn-enviar-recuperacao");

    if (!email) {
        msgEl.textContent = "Por favor, digite um e-mail válido.";
        msgEl.style.color = "#E60000"; // Vermelho para erro
        msgEl.style.display = "block";
        return;
    }

    // Efeito visual de carregamento
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btn.disabled = true;

    try {
        await sendPasswordResetEmail(auth, email);
        
        // Mensagem de sucesso limpa usando a fonte do sistema
        msgEl.textContent = "E-mail enviado! Verifique sua caixa de entrada e sua pasta de Spam.";
        msgEl.style.color = "#28a745"; // Verde para sucesso
        msgEl.style.display = "block";
        
        // Fecha o modal automaticamente após 4 segundos para UX mais fluida
        setTimeout(() => {
            window.closeModal('modal-recuperar-senha');
        }, 4000);
        
    } catch (error) {
        console.error("Erro ao enviar e-mail de recuperação:", error);
        msgEl.textContent = "Erro ao enviar. Verifique se o e-mail digitado está correto.";
        msgEl.style.color = "#E60000"; // Vermelho para erro
        msgEl.style.display = "block";
        
        btn.innerHTML = 'Enviar link de acesso';
        btn.disabled = false;
    }
};

// ==========================================
// COMPRESSÃO E UPLOAD DE IMAGEM
// ==========================================
window.compressImage = function(file, maxWidth = 900, maxHeight = 900, quality = 0.72) {
    return new Promise((resolve, reject) => {
        if (!file) return reject(new Error("Nenhum arquivo selecionado."));
        if (!file.type || !file.type.startsWith("image/")) {
            return reject(new Error("O arquivo selecionado não é uma imagem válida."));
        }

        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível ler a imagem selecionada."));
        reader.onload = event => {
            const img = new Image();
            img.onerror = () => reject(new Error("Não foi possível carregar a imagem para compactação."));
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else if (height > maxHeight) {
                    width = Math.round(width * (maxHeight / height));
                    height = maxHeight;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(blob => {
                    if (!blob) return reject(new Error("Não foi possível compactar a imagem."));

                    const baseName = (file.name || "imagem")
                        .replace(/\.[^/.]+$/, "")
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-zA-Z0-9_-]/g, '_')
                        .slice(0, 60);

                    resolve(new File([blob], `${baseName || 'imagem'}.jpg`, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', quality);
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};

window.fileToDataURL = function(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Não foi possível converter a imagem."));
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
    });
};

// OTIMIZAÇÃO DE PERFORMANCE (importante): agora tentamos sempre subir a imagem
// para o Firebase Storage primeiro. Isso é essencial para a lentidão do app,
// porque salvar imagens como Base64 direto no Firestore (o que estava
// acontecendo antes, com essa flag em false) faz cada leitura de produtos/
// categorias/avisos trazer o texto completo das fotos embutido no documento,
// deixando as consultas e a tela muito mais pesadas do que precisam ser.
//
// Este código é seguro mesmo que o CORS do bucket ainda não tenha sido
// configurado: se o upload para o Storage falhar (ver catch abaixo), ele cai
// automaticamente para o Base64 no Firestore, exatamente como funcionava
// antes — ou seja, nada quebra. Mas para colher o ganho de performance de
// verdade, é necessário aplicar o arquivo cors.json (que já está neste
// projeto) no bucket "favu-app.firebasestorage.app", por exemplo com:
//   gsutil cors set cors.json gs://favu-app.firebasestorage.app
// Isso pode ser feito pelo Google Cloud Shell, sem precisar instalar nada.
const USAR_FIREBASE_STORAGE = true;

async function salvarImagemBase64(compressedFile) {
    const dataUrl = await window.fileToDataURL(compressedFile);

    // Evita estourar o limite de 1MB por documento do Firestore.
    if (dataUrl.length > 900000) {
        throw new Error("Imagem compactada ficou grande demais para salvar no banco. Tente uma imagem menor.");
    }

    return dataUrl;
}

async function upImg(file) {
    if (!file) return "";

    let compressedFile;
    try {
        compressedFile = await window.compressImage(file);
    } catch (e) {
        console.error("Erro ao compactar imagem:", e);
        customAlert("Não foi possível preparar a imagem selecionada.", "Erro no upload");
        throw e;
    }

    // MODO COMPATIBILIDADE: não chama o Storage, então não gera erro de CORS.
    if (!USAR_FIREBASE_STORAGE) {
        try {
            return await salvarImagemBase64(compressedFile);
        } catch (fallbackError) {
            console.error("Falha ao salvar imagem em Base64:", fallbackError);
            customAlert("Erro ao salvar imagem. Tente uma imagem menor ou mais leve.", "Erro no upload");
            throw fallbackError;
        }
    }

    // MODO STORAGE: use somente depois de aplicar corretamente o CORS no bucket.
    try {
        const safeName = compressedFile.name || `imagem_${Date.now()}.jpg`;
        const filename = `imagens/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, filename);

        const snapshot = await uploadBytes(storageRef, compressedFile, {
            contentType: 'image/jpeg',
            cacheControl: 'public,max-age=31536000'
        });

        return await getDownloadURL(snapshot.ref);
    } catch (storageError) {
        console.warn("Firebase Storage bloqueou o upload. Usando fallback em Base64 no Firestore:", storageError);
        try {
            return await salvarImagemBase64(compressedFile);
        } catch (fallbackError) {
            console.error("Falha também no fallback de imagem:", fallbackError);
            customAlert("Erro ao enviar imagem. Verifique o CORS/permissões do Firebase Storage ou tente uma imagem menor.", "Erro no upload");
            throw fallbackError;
        }
    }
}
window.upImg = upImg;

window.previewImage = function(input, imgId, btnId, noneId, hiddenFlagId) {
    const file = input.files[0];
    const img = document.getElementById(imgId);
    const btn = btnId ? document.getElementById(btnId) : null;
    const noneTxt = noneId ? document.getElementById(noneId) : null;
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result; img.style.display = 'block';
            if(btn) btn.style.display = 'inline-block';
            if(noneTxt) noneTxt.style.display = 'none';
        }
        reader.readAsDataURL(file);
        if(hiddenFlagId && document.getElementById(hiddenFlagId)) document.getElementById(hiddenFlagId).value = 'false';
    }
};




// === IMAGENS 2026-06-21: lista, ordenação e recorte individual antes do salvamento ===
window.uploadImageLists = window.uploadImageLists || {};
window.uploadImageDragState = window.uploadImageDragState || null;

window.getUploadImageLabel = function(inputId) {
    const map = {
        'a-file': 'a-file-name',
        'e-file': 'e-file-name',
        'aa-file': 'aa-file-name',
        'ea-file': 'ea-file-name'
    };
    return document.getElementById(map[inputId] || '');
};

window.getUploadImageListEl = function(inputId) {
    const id = `${inputId}-list`;
    let el = document.getElementById(id);
    if (!el) {
        const label = window.getUploadImageLabel(inputId);
        if (label) {
            el = document.createElement('div');
            el.id = id;
            el.className = 'upload-image-list';
            label.insertAdjacentElement('afterend', el);
        }
    }
    return el;
};

window.criarUploadImageEntry = function({ file = null, url = '', name = '', existing = false } = {}) {
    const objectUrl = file ? URL.createObjectURL(file) : url;
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: objectUrl || '',
        savedUrl: existing ? url : '',
        name: name || file?.name || (existing ? 'Imagem salva' : 'Imagem'),
        existing: !!existing
    };
};

window.limparListaImagensUpload = function(inputId) {
    const atual = window.uploadImageLists[inputId] || [];
    atual.forEach(item => {
        if (item.file && item.url && item.url.startsWith('blob:')) {
            try { URL.revokeObjectURL(item.url); } catch(e) {}
        }
    });
    window.uploadImageLists[inputId] = [];
    if (window.uploadImagePreviewIndex) window.uploadImagePreviewIndex[inputId] = 0;
    window.renderListaImagensUpload(inputId);
};

window.carregarImagensExistentesUpload = function(inputId, urls = []) {
    window.limparListaImagensUpload(inputId);
    window.uploadImagePreviewIndex[inputId] = 0;
    window.uploadImageLists[inputId] = (urls || []).filter(Boolean).map((url, idx) => window.criarUploadImageEntry({
        url,
        name: `Imagem ${idx + 1}`,
        existing: true
    }));
    window.renderListaImagensUpload(inputId);
};

window.adicionarImagensUpload = function(inputId) {
    const input = document.getElementById(inputId);
    const files = input?.files ? Array.from(input.files).filter(f => f && f.type && f.type.startsWith('image/')) : [];
    if (!window.uploadImageLists[inputId]) window.uploadImageLists[inputId] = [];

    files.forEach(file => {
        window.uploadImageLists[inputId].push(window.criarUploadImageEntry({ file, name: file.name, existing: false }));
    });

    if (input) input.value = '';
    window.uploadImagePreviewIndex[inputId] = Math.max(0, (window.uploadImageLists[inputId] || []).length - files.length);
    window.renderListaImagensUpload(inputId);
};


// === IMAGENS 2026-06-21: carrossel no preview atual/nova ===
window.uploadImagePreviewIndex = window.uploadImagePreviewIndex || {};

window.getPreviewIdsUpload = function(inputId) {
    const map = {
        'a-file': ['a-img-preview', 'a-img-none', 'a-img-counter'],
        'e-file': ['e-img-preview', 'e-img-none', 'e-img-counter'],
        'aa-file': ['aa-img-preview', 'aa-img-none', 'aa-img-counter'],
        'ea-file': ['ea-img-preview', 'ea-img-none', 'ea-img-counter']
    };
    return map[inputId] || [];
};

window.atualizarPreviewImagemUpload = function(inputId) {
    const list = window.uploadImageLists?.[inputId] || [];
    const [previewId, noneId, counterId] = window.getPreviewIdsUpload(inputId);

    const preview = document.getElementById(previewId);
    const none = document.getElementById(noneId);
    const counter = document.getElementById(counterId);
    const wrap = document.querySelector(`.upload-current-carousel[data-input-id="${inputId}"]`);
    const prev = wrap?.querySelector('.upload-current-btn.prev');
    const next = wrap?.querySelector('.upload-current-btn.next');

    let idx = Number(window.uploadImagePreviewIndex[inputId] || 0);
    if (idx >= list.length) idx = Math.max(0, list.length - 1);
    if (idx < 0) idx = 0;
    window.uploadImagePreviewIndex[inputId] = idx;

    if (wrap) wrap.style.display = list.length ? 'inline-flex' : 'none';

    if (preview) {
        if (list.length && list[idx]?.url) {
            preview.src = list[idx].url;
            preview.style.display = 'block';
        } else {
            preview.src = '';
            preview.style.display = 'none';
        }
    }

    if (none) none.style.display = 'none';

    if (counter) {
        counter.textContent = list.length > 1 ? `${idx + 1}/${list.length}` : '';
        counter.style.display = list.length > 1 ? 'inline-flex' : 'none';
    }

    if (prev) prev.style.display = list.length > 1 ? 'inline-flex' : 'none';
    if (next) next.style.display = list.length > 1 ? 'inline-flex' : 'none';
};


window.uploadPreviewTimers = window.uploadPreviewTimers || {};

window.iniciarPreviewImagemUploadAuto = function(inputId) {
    const list = window.uploadImageLists?.[inputId] || [];
    if (window.uploadPreviewTimers[inputId]) {
        clearInterval(window.uploadPreviewTimers[inputId]);
        window.uploadPreviewTimers[inputId] = null;
    }
    if (list.length <= 1) return;

    window.uploadPreviewTimers[inputId] = setInterval(() => {
        const atual = Number(window.uploadImagePreviewIndex[inputId] || 0);
        window.uploadImagePreviewIndex[inputId] = (atual + 1) % list.length;
        window.atualizarPreviewImagemUpload(inputId);
    }, 2600);
};

window.mudarPreviewImagemUpload = function(inputId, delta) {
    const list = window.uploadImageLists?.[inputId] || [];
    if (!list.length) return;

    const atual = Number(window.uploadImagePreviewIndex[inputId] || 0);
    window.uploadImagePreviewIndex[inputId] = (atual + delta + list.length) % list.length;
    window.atualizarPreviewImagemUpload(inputId);
    window.iniciarPreviewImagemUploadAuto?.(inputId);
};


window.limparCamposImagemUploadSeVazio = function(inputId) {
    const list = window.uploadImageLists?.[inputId] || [];
    if (list.length) return;
    const label = window.getUploadImageLabel?.(inputId);
    if (label) label.textContent = '';
    window.atualizarPreviewImagemUpload?.(inputId);
};

window.renderListaImagensUpload = function(inputId) {
    const list = window.uploadImageLists[inputId] || [];
    const el = window.getUploadImageListEl(inputId);
    const label = window.getUploadImageLabel(inputId);
    const isEdit = inputId === 'e-file' || inputId === 'ea-file';

    if (label) label.textContent = list.length ? `${list.length} imagem(ns) na ordem de exibição` : '';

    const previewMap = {
        'a-file': ['a-img-preview', 'a-img-none'],
        'e-file': ['e-img-preview', 'e-img-none'],
        'aa-file': ['aa-img-preview', 'aa-img-none'],
        'ea-file': ['ea-img-preview', 'ea-img-none']
    };

    const [previewId, noneId] = previewMap[inputId] || [];
    const preview = document.getElementById(previewId);
    const none = document.getElementById(noneId);
    const removeBtn = document.getElementById(inputId === 'e-file' ? 'btn-remove-e-img' : inputId === 'ea-file' ? 'btn-remove-ea-img' : '');

    window.atualizarPreviewImagemUpload?.(inputId);
    if (removeBtn) removeBtn.style.display = 'none';

    window.iniciarPreviewImagemUploadAuto?.(inputId);

    if (!el) return;
    if (!list.length) {
        el.innerHTML = '';
        return;
    }

    el.innerHTML = list.map((item, idx) => `
        <div class="upload-image-row" draggable="true" data-input-id="${inputId}" data-index="${idx}"
            ondragstart="window.dragImagemUploadStart(event)"
            ondragover="window.dragImagemUploadOver(event)"
            ondrop="window.dropImagemUpload(event)">
            <div class="upload-image-order" title="Ordem de exibição"><span>${idx + 1}</span><i>☰</i></div>
            <div class="upload-image-thumb-wrap">
                <img src="${item.url}" alt="Imagem ${idx + 1}">
                <small>${item.existing ? 'Imagem salva' : 'Imagem nova, ainda não salva'}</small>
            </div>
            <div class="upload-image-info">
                <strong>${escapeHTML(item.name || 'Imagem')}</strong>
            </div>
            <div class="upload-image-actions">
                <button type="button" class="btn-action edit" title="Editar recorte" onclick="window.abrirCropImagemUpload('${inputId}', ${idx})"><i class="fas fa-crop-alt"></i></button>
                <button type="button" class="btn-action del" title="Excluir imagem" onclick="window.excluirImagemUpload('${inputId}', ${idx})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
};

window.dragImagemUploadStart = function(event) {
    const row = event.currentTarget;
    window.uploadImageDragState = {
        inputId: row.dataset.inputId,
        index: Number(row.dataset.index)
    };
    row.classList.add('dragging');
};

window.dragImagemUploadOver = function(event) {
    event.preventDefault();
};

window.dropImagemUpload = function(event) {
    event.preventDefault();
    const row = event.currentTarget;
    const targetInputId = row.dataset.inputId;
    const targetIndex = Number(row.dataset.index);
    const drag = window.uploadImageDragState;

    document.querySelectorAll('.upload-image-row.dragging').forEach(el => el.classList.remove('dragging'));

    if (!drag || drag.inputId !== targetInputId || drag.index === targetIndex) return;

    const list = window.uploadImageLists[targetInputId] || [];
    const [moved] = list.splice(drag.index, 1);
    list.splice(targetIndex, 0, moved);
    window.uploadImageDragState = null;
    window.uploadImagePreviewIndex[targetInputId] = targetIndex;
    window.renderListaImagensUpload(targetInputId);
};

window.excluirImagemUpload = function(inputId, index) {
    const list = window.uploadImageLists[inputId] || [];
    const item = list[index];
    if (!item) return;

    customConfirm('Excluir esta imagem da lista?', () => {
        if (item.file && item.url && item.url.startsWith('blob:')) {
            try { URL.revokeObjectURL(item.url); } catch(e) {}
        }
        list.splice(index, 1);
        if (window.uploadImagePreviewIndex) window.uploadImagePreviewIndex[inputId] = Math.min(Number(window.uploadImagePreviewIndex[inputId] || 0), Math.max(0, list.length - 1));
        if (inputId === 'e-file') {
            const rem = document.getElementById('e-remove-img');
            if (rem && !list.length) rem.value = 'true';
        }
        if (inputId === 'ea-file') {
            const rem = document.getElementById('ea-remove-img');
            if (rem && !list.length) rem.value = 'true';
        }
        window.renderListaImagensUpload(inputId);
    });
};

window.abrirCropImagemUpload = function(inputId, index) {
    const list = window.uploadImageLists[inputId] || [];
    const item = list[index];
    if (!item) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        window.produtoCropState = {
            inputId,
            imageIndex: index,
            files: [],
            index: 0,
            output: [],
            modo: 'square',
            img,
            objectUrl: '',
            zoom: 1,
            x: 50,
            y: 50,
            w: 100,
            h: 100
        };

        ['produto-crop-zoom','produto-crop-x','produto-crop-y','produto-crop-w','produto-crop-h'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id.endsWith('zoom')) el.value = 1;
            else if (id.endsWith('x') || id.endsWith('y')) el.value = 50;
            else el.value = 100;
        });

        const status = document.getElementById('produto-crop-status');
        if (status) status.textContent = `Editando imagem ${index + 1} de ${list.length}`;

        window.setCropProdutoModo();
        const modal = document.getElementById('modal-crop-produto');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
        document.body.style.overflow = 'hidden';
        window.renderCropProdutoCanvas();
    };
    img.onerror = () => window.showToast('Não foi possível carregar esta imagem para recorte.', true);
    img.src = item.url;
};

window.aplicarCropProduto = function() {
    const st = window.produtoCropState;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!st || !canvas) return;

    canvas.toBlob(blob => {
        if (!blob) return window.showToast('Não foi possível aplicar o recorte.', true);

        const list = window.uploadImageLists[st.inputId] || [];
        const item = list[st.imageIndex];
        if (!item) return;

        if (item.file && item.url && item.url.startsWith('blob:')) {
            try { URL.revokeObjectURL(item.url); } catch(e) {}
        }

        const nomeBase = (item.name || 'imagem').replace(/\.[^.]+$/, '');
        const file = window.blobParaFileProduto(blob, `${nomeBase}-recorte.webp`);
        item.file = file;
        item.existing = false;
        item.savedUrl = '';
        item.url = URL.createObjectURL(file);
        item.name = file.name;

        window.fecharCropProdutoModal();
        window.uploadImagePreviewIndex[st.inputId] = st.imageIndex || 0;
        window.renderListaImagensUpload(st.inputId);
    }, 'image/webp', 0.92);
};

window.usarOriginalCropProduto = function() {
    window.fecharCropProdutoModal();
};

window.finalizarCropProdutoUpload = function() {
    window.fecharCropProdutoModal();
};

window.cancelarCropProdutoUpload = function() {
    window.fecharCropProdutoModal();
};

window.fecharCropProdutoModal = function() {
    const modal = document.getElementById('modal-crop-produto');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    window.produtoCropState = null;
};

window.uploadProdutoImagens = async function(inputId) {
    const list = window.uploadImageLists[inputId] || [];
    const urls = [];

    if (!list.length) return [];

    for (const item of list) {
        if (item.savedUrl && !item.file) {
            urls.push(item.savedUrl);
        } else if (item.file) {
            const url = await upImg(item.file);
            if (url) urls.push(url);
        } else if (item.url && !item.url.startsWith('blob:')) {
            urls.push(item.url);
        }
    }

    return urls;
};

window.uploadImagensRecortadas = window.uploadProdutoImagens;


// === PRODUTOS 2026-06-21: recorte/crop direto no upload ===
window.produtoCropArquivos = window.produtoCropArquivos || {};
window.produtoCropState = null;

window.blobParaFileProduto = function(blob, nome) {
    return new File([blob], nome, { type: blob.type || 'image/webp', lastModified: Date.now() });
};

window.iniciarCropProdutoUpload = function(inputId) {
    const input = document.getElementById(inputId);
    const files = input?.files ? Array.from(input.files).filter(f => f && f.type && f.type.startsWith('image/')) : [];
    window.produtoCropArquivos[inputId] = [];

    if (!files.length) return;

    window.produtoCropState = {
        inputId,
        files,
        index: 0,
        output: [],
        modo: 'square',
        img: null,
        objectUrl: '',
        zoom: 1,
        x: 50,
        y: 50,
        w: 100,
        h: 100
    };

    window.carregarImagemAtualCropProduto();
};

window.carregarImagemAtualCropProduto = function() {
    const st = window.produtoCropState;
    if (!st || !st.files[st.index]) return window.finalizarCropProdutoUpload();

    const file = st.files[st.index];
    if (st.objectUrl) URL.revokeObjectURL(st.objectUrl);
    st.objectUrl = URL.createObjectURL(file);

    const img = new Image();
    img.onload = () => {
        st.img = img;
        st.zoom = 1;
        st.x = 50;
        st.y = 50;
        st.w = 100;
        st.h = 100;

        ['produto-crop-zoom','produto-crop-x','produto-crop-y','produto-crop-w','produto-crop-h'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id.endsWith('zoom')) el.value = 1;
            else if (id.endsWith('x') || id.endsWith('y')) el.value = 50;
            else el.value = 100;
        });

        const status = document.getElementById('produto-crop-status');
        if (status) status.textContent = `Foto ${st.index + 1} de ${st.files.length}: ${file.name}`;

        window.setCropProdutoModo(st.modo || 'square');
        const modal = document.getElementById('modal-crop-produto');
        if (modal) {
            modal.style.display = 'flex';
            modal.classList.add('show');
        }
        document.body.style.overflow = 'hidden';
        window.renderCropProdutoCanvas();
    };
    img.onerror = () => {
        st.output.push(file);
        st.index += 1;
        window.carregarImagemAtualCropProduto();
    };
    img.src = st.objectUrl;
};

window.setCropProdutoModo = function(modo) {
    const st = window.produtoCropState;
    if (st) st.modo = modo === 'free' ? 'free' : 'square';

    const modal = document.getElementById('modal-crop-produto');
    if (modal) modal.classList.toggle('square-mode', (st?.modo || modo) !== 'free');

    const btnSquare = document.getElementById('produto-crop-square-btn');
    const btnFree = document.getElementById('produto-crop-free-btn');

    if (btnSquare && btnFree) {
        btnSquare.className = (st?.modo || modo) === 'square' ? 'btn btn-primary' : 'btn btn-outline';
        btnFree.className = (st?.modo || modo) === 'free' ? 'btn btn-primary' : 'btn btn-outline';
    }

    window.renderCropProdutoCanvas?.();
};

window.atualizarCropProdutoControle = function() {
    const st = window.produtoCropState;
    if (!st) return;
    st.zoom = Number(document.getElementById('produto-crop-zoom')?.value || 1);
    st.x = Number(document.getElementById('produto-crop-x')?.value || 50);
    st.y = Number(document.getElementById('produto-crop-y')?.value || 50);
    st.w = Number(document.getElementById('produto-crop-w')?.value || 100);
    st.h = Number(document.getElementById('produto-crop-h')?.value || 100);
    window.renderCropProdutoCanvas();
};

window.getCropProdutoRect = function() {
    const st = window.produtoCropState;
    const img = st?.img;
    if (!img) return null;

    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const zoom = Math.max(1, Number(st.zoom || 1));

    let sw, sh;
    if (st.modo === 'free') {
        sw = Math.max(1, nw * (Number(st.w || 100) / 100) / zoom);
        sh = Math.max(1, nh * (Number(st.h || 100) / 100) / zoom);
    } else {
        const lado = Math.min(nw, nh) / zoom;
        sw = lado;
        sh = lado;
    }

    sw = Math.min(sw, nw);
    sh = Math.min(sh, nh);

    const sx = (nw - sw) * (Number(st.x || 50) / 100);
    const sy = (nh - sh) * (Number(st.y || 50) / 100);

    return { sx, sy, sw, sh };
};

window.renderCropProdutoCanvas = function() {
    const st = window.produtoCropState;
    const img = st?.img;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!img || !canvas) return;

    const rect = window.getCropProdutoRect();
    if (!rect) return;

    const maxOut = 900;
    let outW, outH;

    if (st.modo === 'free') {
        const ratio = rect.sw / rect.sh;
        if (ratio >= 1) {
            outW = maxOut;
            outH = Math.max(260, Math.round(maxOut / ratio));
        } else {
            outH = maxOut;
            outW = Math.max(260, Math.round(maxOut * ratio));
        }
    } else {
        outW = maxOut;
        outH = maxOut;
    }

    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, outW, outH);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, outW, outH);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, outW, outH);
};

window.aplicarCropProduto = function() {
    const st = window.produtoCropState;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!st || !canvas) return;

    canvas.toBlob(blob => {
        if (!blob) {
            st.output.push(st.files[st.index]);
        } else {
            const nomeBase = (st.files[st.index]?.name || 'produto').replace(/\.[^.]+$/, '');
            st.output.push(window.blobParaFileProduto(blob, `${nomeBase}-recorte.webp`));
        }
        st.index += 1;
        window.carregarImagemAtualCropProduto();
    }, 'image/webp', 0.92);
};

window.usarOriginalCropProduto = function() {
    const st = window.produtoCropState;
    if (!st) return;
    st.output.push(st.files[st.index]);
    st.index += 1;
    window.carregarImagemAtualCropProduto();
};

window.finalizarCropProdutoUpload = function() {
    const st = window.produtoCropState;
    if (!st) return;

    if (st.objectUrl) URL.revokeObjectURL(st.objectUrl);

    window.produtoCropArquivos[st.inputId] = st.output.length ? st.output : st.files;

    const nameMap = { 'a-file': 'a-file-name', 'e-file': 'e-file-name', 'aa-file': 'aa-file-name', 'ea-file': 'ea-file-name' };
    const previewMap = { 'a-file': 'a-img-preview', 'e-file': 'e-img-preview', 'aa-file': 'aa-img-preview', 'ea-file': 'ea-img-preview' };
    const nameEl = document.getElementById(nameMap[st.inputId] || '');
    if (nameEl) nameEl.textContent = `${window.produtoCropArquivos[st.inputId].length} foto(s) editada(s)`;

    const previewId = previewMap[st.inputId] || (st.inputId === 'a-file' ? 'a-img-preview' : 'e-img-preview');
    const preview = document.getElementById(previewId);
    if (preview && window.produtoCropArquivos[st.inputId][0]) {
        preview.src = URL.createObjectURL(window.produtoCropArquivos[st.inputId][0]);
        preview.style.display = 'block';
    }

    if (st.inputId === 'e-file' || st.inputId === 'ea-file') {
        const rem = document.getElementById(st.inputId === 'e-file' ? 'e-remove-img' : 'ea-remove-img');
        if (rem) rem.value = 'false';
        const btn = document.getElementById(st.inputId === 'e-file' ? 'btn-remove-e-img' : 'btn-remove-ea-img');
        if (btn) btn.style.display = 'inline-flex';
        const none = document.getElementById(st.inputId === 'e-file' ? 'e-img-none' : 'ea-img-none');
        if (none) none.style.display = 'none';
    }

    const modal = document.getElementById('modal-crop-produto');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    window.produtoCropState = null;
};

window.cancelarCropProdutoUpload = function() {
    const st = window.produtoCropState;
    if (st) {
        if (st.objectUrl) URL.revokeObjectURL(st.objectUrl);
        window.produtoCropArquivos[st.inputId] = st.output.length ? st.output : st.files;
    }
    const modal = document.getElementById('modal-crop-produto');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    window.produtoCropState = null;
};





// === IMAGENS 2026-06-21: crop 4x4 com arraste e zoom ===
window.cropProdutoDrag = null;

window.setCropProdutoModo = function() {
    const st = window.produtoCropState;
    if (st) st.modo = 'square';
    const modal = document.getElementById('modal-crop-produto');
    if (modal) modal.classList.add('square-mode');
    window.renderCropProdutoCanvas?.();
};

window.atualizarCropProdutoControle = function() {
    const st = window.produtoCropState;
    if (!st) return;
    st.modo = 'square';
    st.zoom = Number(document.getElementById('produto-crop-zoom')?.value || 1);
    st.x = Number(document.getElementById('produto-crop-x')?.value || 50);
    st.y = Number(document.getElementById('produto-crop-y')?.value || 50);
    window.renderCropProdutoCanvas();
};

window.getCropProdutoRect = function() {
    const st = window.produtoCropState;
    const img = st?.img;
    if (!img) return null;

    const nw = img.naturalWidth || img.width;
    const nh = img.naturalHeight || img.height;
    const zoom = Math.max(1, Number(st.zoom || 1));
    const lado = Math.min(nw, nh) / zoom;
    const sw = Math.min(lado, nw);
    const sh = Math.min(lado, nh);
    const sx = Math.max(0, Math.min(nw - sw, (nw - sw) * (Number(st.x || 50) / 100)));
    const sy = Math.max(0, Math.min(nh - sh, (nh - sh) * (Number(st.y || 50) / 100)));

    return { sx, sy, sw, sh };
};

window.renderCropProdutoCanvas = function() {
    const st = window.produtoCropState;
    const img = st?.img;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!img || !canvas) return;

    const rect = window.getCropProdutoRect();
    if (!rect) return;

    const out = 900;
    canvas.width = out;
    canvas.height = out;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, out, out);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out, out);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.96)';
    ctx.lineWidth = 10;
    ctx.setLineDash([28, 18]);
    ctx.strokeRect(12, 12, out - 24, out - 24);

    ctx.strokeStyle = 'rgba(224,159,65,.95)';
    ctx.lineWidth = 5;
    ctx.setLineDash([18, 14]);
    ctx.strokeRect(18, 18, out - 36, out - 36);
    ctx.restore();
};

window.getCropPointerPos = function(event) {
    const canvas = document.getElementById('produto-crop-canvas');
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
};

window.iniciarArrasteCropProduto = function(event) {
    const st = window.produtoCropState;
    if (!st) return;
    event.preventDefault();
    const p = window.getCropPointerPos(event);
    window.cropProdutoDrag = { startX: p.x, startY: p.y, originalX: Number(st.x || 50), originalY: Number(st.y || 50) };
};

window.moverArrasteCropProduto = function(event) {
    const st = window.produtoCropState;
    const drag = window.cropProdutoDrag;
    if (!st || !drag) return;
    event.preventDefault();

    const p = window.getCropPointerPos(event);
    const canvas = document.getElementById('produto-crop-canvas');
    const rect = canvas?.getBoundingClientRect();
    const w = rect?.width || 1;
    const h = rect?.height || 1;

    const dx = ((p.x - drag.startX) / w) * 100;
    const dy = ((p.y - drag.startY) / h) * 100;

    // Arrastar a imagem para direita deve revelar a parte esquerda; por isso inverte.
    st.x = Math.max(0, Math.min(100, drag.originalX - dx));
    st.y = Math.max(0, Math.min(100, drag.originalY - dy));

    const inputX = document.getElementById('produto-crop-x');
    const inputY = document.getElementById('produto-crop-y');
    if (inputX) inputX.value = st.x;
    if (inputY) inputY.value = st.y;

    window.renderCropProdutoCanvas();
};

window.finalizarArrasteCropProduto = function() {
    window.cropProdutoDrag = null;
};



// === IMAGENS 2026-06-21: zoom por pinça sem barras ===
window.distanciaToqueCropProduto = function(event) {
    if (!event.touches || event.touches.length < 2) return 0;
    const a = event.touches[0];
    const b = event.touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
};

window.iniciarArrasteCropProduto = function(event) {
    const st = window.produtoCropState;
    if (!st) return;
    event.preventDefault();

    if (event.touches && event.touches.length >= 2) {
        window.cropProdutoDrag = null;
        window.cropProdutoPinch = {
            startDistance: window.distanciaToqueCropProduto(event),
            originalZoom: Number(st.zoom || 1)
        };
        return;
    }

    const p = window.getCropPointerPos(event);
    window.cropProdutoPinch = null;
    window.cropProdutoDrag = {
        startX: p.x,
        startY: p.y,
        originalX: Number(st.x || 50),
        originalY: Number(st.y || 50)
    };
};

window.moverArrasteCropProduto = function(event) {
    const st = window.produtoCropState;
    if (!st) return;
    event.preventDefault();

    if (event.touches && event.touches.length >= 2) {
        if (!window.cropProdutoPinch) {
            window.cropProdutoPinch = {
                startDistance: window.distanciaToqueCropProduto(event),
                originalZoom: Number(st.zoom || 1)
            };
        }

        const dist = window.distanciaToqueCropProduto(event);
        const start = window.cropProdutoPinch.startDistance || dist || 1;
        const novoZoom = Math.max(1, Math.min(4, window.cropProdutoPinch.originalZoom * (dist / start)));

        st.zoom = novoZoom;
        const inputZoom = document.getElementById('produto-crop-zoom');
        if (inputZoom) inputZoom.value = novoZoom;
        window.renderCropProdutoCanvas();
        return;
    }

    const drag = window.cropProdutoDrag;
    if (!drag) return;

    const p = window.getCropPointerPos(event);
    const canvas = document.getElementById('produto-crop-canvas');
    const rect = canvas?.getBoundingClientRect();
    const w = rect?.width || 1;
    const h = rect?.height || 1;

    const dx = ((p.x - drag.startX) / w) * 100;
    const dy = ((p.y - drag.startY) / h) * 100;

    st.x = Math.max(0, Math.min(100, drag.originalX - dx));
    st.y = Math.max(0, Math.min(100, drag.originalY - dy));

    const inputX = document.getElementById('produto-crop-x');
    const inputY = document.getElementById('produto-crop-y');
    if (inputX) inputX.value = st.x;
    if (inputY) inputY.value = st.y;

    window.renderCropProdutoCanvas();
};

window.finalizarArrasteCropProduto = function() {
    window.cropProdutoDrag = null;
    window.cropProdutoPinch = null;
};

window.zoomCropProdutoWheel = function(event) {
    const st = window.produtoCropState;
    if (!st) return;
    event.preventDefault();
    const delta = event.deltaY < 0 ? 0.12 : -0.12;
    st.zoom = Math.max(1, Math.min(4, Number(st.zoom || 1) + delta));
    const inputZoom = document.getElementById('produto-crop-zoom');
    if (inputZoom) inputZoom.value = st.zoom;
    window.renderCropProdutoCanvas();
};


// === IMAGENS 2026-06-21: sobrescreve crop em lote por crop individual ===
window.aplicarCropProduto = function() {
    const st = window.produtoCropState;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!st || !canvas) return;

    canvas.toBlob(blob => {
        if (!blob) return window.showToast('Não foi possível aplicar o recorte.', true);
        const list = window.uploadImageLists[st.inputId] || [];
        const item = list[st.imageIndex];
        if (!item) return;

        if (item.file && item.url && item.url.startsWith('blob:')) {
            try { URL.revokeObjectURL(item.url); } catch(e) {}
        }

        const nomeBase = (item.name || 'imagem').replace(/\.[^.]+$/, '');
        const file = window.blobParaFileProduto(blob, `${nomeBase}-recorte.webp`);
        item.file = file;
        item.existing = false;
        item.savedUrl = '';
        item.url = URL.createObjectURL(file);
        item.name = file.name;

        window.fecharCropProdutoModal();
        window.renderListaImagensUpload(st.inputId);
    }, 'image/webp', 0.92);
};

window.usarOriginalCropProduto = function() {
    window.fecharCropProdutoModal();
};

window.finalizarCropProdutoUpload = function() {
    window.fecharCropProdutoModal();
};

window.cancelarCropProdutoUpload = function() {
    window.fecharCropProdutoModal();
};

window.fecharCropProdutoModal = function() {
    const modal = document.getElementById('modal-crop-produto');
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
    document.body.style.overflow = 'auto';
    window.produtoCropState = null;
};

window.uploadProdutoImagens = async function(inputId) {
    const list = window.uploadImageLists[inputId] || [];
    const urls = [];
    if (!list.length) return [];
    for (const item of list) {
        if (item.savedUrl && !item.file) urls.push(item.savedUrl);
        else if (item.file) {
            const url = await upImg(item.file);
            if (url) urls.push(url);
        } else if (item.url && !item.url.startsWith('blob:')) urls.push(item.url);
    }
    return urls;
};
window.uploadImagensRecortadas = window.uploadProdutoImagens;


// === FIX 2026-08-01: recorte de produto não pode gravar a moldura tracejada de guia na foto salva ===
// renderCropProdutoCanvas() desenha, por cima da imagem, um contorno tracejado (branco + laranja)
// que serve apenas de guia visual durante o ajuste do recorte. Como aplicarCropProduto() gerava o
// arquivo final com canvas.toBlob() a partir desse mesmo canvas, essa moldura ficava gravada dentro
// da própria foto e aparecia como uma margem de recorte nas fotos exibidas para o cliente. Esta
// função redesenha o canvas sem o contorno de guia só no instante da exportação, sem alterar em
// nada a pré-visualização interativa (arraste/zoom continuam mostrando a moldura normalmente).
window.renderCropProdutoCanvasParaExportacao = function() {
    const st = window.produtoCropState;
    const img = st?.img;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!img || !canvas) return false;

    const rect = window.getCropProdutoRect();
    if (!rect) return false;

    const out = 900;
    canvas.width = out;
    canvas.height = out;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, out, out);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, out, out);
    return true;
};

window.aplicarCropProduto = function() {
    const st = window.produtoCropState;
    const canvas = document.getElementById('produto-crop-canvas');
    if (!st || !canvas) return;

    // Remove a moldura-guia do canvas antes de capturar o blob que será salvo/enviado.
    window.renderCropProdutoCanvasParaExportacao();

    canvas.toBlob(blob => {
        if (!blob) return window.showToast('Não foi possível aplicar o recorte.', true);
        const list = window.uploadImageLists[st.inputId] || [];
        const item = list[st.imageIndex];
        if (!item) return;

        if (item.file && item.url && item.url.startsWith('blob:')) {
            try { URL.revokeObjectURL(item.url); } catch(e) {}
        }

        const nomeBase = (item.name || 'imagem').replace(/\.[^.]+$/, '');
        const file = window.blobParaFileProduto(blob, `${nomeBase}-recorte.webp`);
        item.file = file;
        item.existing = false;
        item.savedUrl = '';
        item.url = URL.createObjectURL(file);
        item.name = file.name;

        window.fecharCropProdutoModal();
        window.renderListaImagensUpload(st.inputId);
    }, 'image/webp', 0.92);
};


// === IMAGENS 2026-06-21: carrossel automático admin ===
window.renderAutoCarouselAdmin = function(urls = [], classeExtra = '') {
    const imagens = (urls || []).filter(Boolean);
    if (!imagens.length) {
        return `<div class="img-preview admin-auto-carousel-empty" style="background:#eee; display:flex; align-items:center; justify-content:center;"><i class="fas fa-image" style="color:#ccc;"></i></div>`;
    }

    return `<div class="admin-auto-carousel ${classeExtra}" data-count="${imagens.length}">
        ${imagens.map((url, idx) => `<img src="${url}" alt="Imagem ${idx + 1}" class="${idx === 0 ? 'active' : ''}">`).join('')}
        ${imagens.length > 1 ? `<span class="admin-auto-carousel-count">1/${imagens.length}</span>` : ''}
    </div>`;
};

window.iniciarCarrosseisAutomaticosAdmin = function(scope = document) {
    const root = scope || document;
    root.querySelectorAll('.admin-auto-carousel').forEach(carousel => {
        if (carousel.dataset.carouselStarted === 'true') return;
        const imgs = Array.from(carousel.querySelectorAll('img'));
        if (imgs.length <= 1) return;

        carousel.dataset.carouselStarted = 'true';
        let idx = imgs.findIndex(img => img.classList.contains('active'));
        if (idx < 0) idx = 0;

        setInterval(() => {
            imgs[idx]?.classList.remove('active');
            idx = (idx + 1) % imgs.length;
            imgs[idx]?.classList.add('active');

            const count = carousel.querySelector('.admin-auto-carousel-count');
            if (count) count.textContent = `${idx + 1}/${imgs.length}`;
        }, 2600);
    });
};

window.getAvisoImagens = function(a) {
    const imgs = [];
    if (Array.isArray(a?.imagensUrls)) a.imagensUrls.forEach(url => { if (url && !imgs.includes(url)) imgs.push(url); });
    if (a?.imagemUrl && !imgs.includes(a.imagemUrl)) imgs.push(a.imagemUrl);
    return imgs;
};

window.getProdutoImagens = function(p) {
    const imgs = [];
    if (Array.isArray(p?.imagensUrls)) p.imagensUrls.forEach(url => { if (url && !imgs.includes(url)) imgs.push(url); });
    if (p?.imagemUrl && !imgs.includes(p.imagemUrl)) imgs.push(p.imagemUrl);
    return imgs;
};

window.markImageForRemoval = function(type) {
    if(type === 'prod') {
        document.getElementById('e-img-preview').style.display = 'none'; document.getElementById('e-img-preview').src = '';
        document.getElementById('btn-remove-e-img').style.display = 'none'; document.getElementById('e-img-none').style.display = 'block';
        document.getElementById('e-file').value = ''; document.getElementById('e-file-name').textContent = ''; if (window.produtoCropArquivos) window.produtoCropArquivos['e-file'] = [];
        document.getElementById('e-remove-img').value = 'true';
    } else if (type === 'aviso') {
        document.getElementById('ea-img-preview').style.display = 'none'; document.getElementById('ea-img-preview').src = '';
        document.getElementById('btn-remove-ea-img').style.display = 'none'; document.getElementById('ea-img-none').style.display = 'block';
        document.getElementById('ea-file').value = ''; document.getElementById('ea-file-name').textContent = ''; if (window.produtoCropArquivos) window.produtoCropArquivos['ea-file'] = [];
        document.getElementById('ea-remove-img').value = 'true';
    }
};

window.toggleAll = function(headerCheckbox, type) {
    document.querySelectorAll(`#tbl-${type} .row-checkbox`).forEach(cb => cb.checked = headerCheckbox.checked);
    window.checkSelection(type);
};

window.checkSelection = function(type) {
    const checked = document.querySelectorAll(`#tbl-${type} .row-checkbox:checked`).length;
    const bar = document.getElementById(`bulk-actions-${type}`);
    const countEl = document.getElementById(`count-${type}`);
    if (countEl) countEl.textContent = checked;

    if (type === 'categorias') {
        const label = document.getElementById('bulk-label-categorias');
        if (label) label.innerHTML = `<strong id="count-categorias">${checked}</strong> ${checked === 1 ? 'categoria' : 'categorias'}`;
    }
    if (type === 'avisos') {
        const label = document.getElementById('bulk-label-avisos');
        if (label) label.innerHTML = `<strong id="count-avisos">${checked}</strong> ${checked === 1 ? 'comunicado' : 'comunicados'}`;
    }

    if(checked > 0) bar.classList.add('active'); else bar.classList.remove('active');
};

window.clearSelection = function(type) {
    document.querySelectorAll(`#tbl-${type} .row-checkbox`).forEach(cb => cb.checked = false);
    const headerCb = document.querySelector(`#tbl-${type} th .bulk-checkbox`);
    if(headerCb) headerCb.checked = false;
    window.checkSelection(type);
};

window.bulkToggle = async function(type, status) {
    const checkboxes = document.querySelectorAll(`#tbl-${type} .row-checkbox:checked`);
    if(checkboxes.length === 0) return;
    for(let cb of checkboxes) await updateDoc(doc(db, type, cb.value), {ativo: status});
    customAlert(`Status alterado com sucesso!`);
    window.clearSelection(type);
    if(type === 'produtos') loadProds(); if(type === 'categorias') syncCats(); if(type === 'avisos') loadAvisos();
};

window.bulkDelete = function(type) {
    const checkboxes = document.querySelectorAll(`#tbl-${type} .row-checkbox:checked`);
    if(checkboxes.length === 0) return;
    customConfirm(`Excluir permanentemente ${checkboxes.length} item(ns)?`, async () => {
        for(let cb of checkboxes) await deleteDoc(doc(db, type, cb.value));
        customAlert("Itens excluídos!"); window.clearSelection(type);
        if(type === 'produtos') loadProds(); if(type === 'categorias') syncCats(); if(type === 'avisos') loadAvisos();
    });
};

document.getElementById('search-cat').addEventListener('input', () => { window.renderCatsTable(); });
window.limparFiltroCategorias = function() {
    const campo = document.getElementById('search-cat');
    if (campo) campo.value = '';
    window.renderCatsTable();
};

function normalizeDateBR(dateValue) {
    if (!dateValue) return '-';
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        const [y, m, d] = dateValue.split('-');
        return `${d}/${m}/${y}`;
    }
    const d = new Date(dateValue);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR');
}

function getScheduleParts(c, prefix) {
    const dateKey = `${prefix}Data`;
    const timeKey = `${prefix}Hora`;
    let data = c[dateKey] || '';
    let hora = c[timeKey] || '';

    // Compatibilidade com categorias antigas que só tinham timestamp em inicio/fim
    const timestamp = c[prefix];
    if ((!data || !hora) && timestamp) {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const d = new Date(timestamp - tzOffset);
        if (!isNaN(d.getTime())) {
            if (!data) data = d.toISOString().split('T')[0];
            if (!hora) hora = d.toISOString().split('T')[1].slice(0, 5);
        }
    }

    return { data, hora };
}

function formatScheduleValue(data, hora) {
    const dataBR = normalizeDateBR(data);
    const parts = [];

    if (dataBR && dataBR !== '-') parts.push(dataBR);
    if (hora) parts.push(hora);

    return parts.length ? parts.join(' | ') : '-';
}

function formatScheduleLine(label, data, hora) {
    const value = formatScheduleValue(data, hora);
    return value === '-' ? '' : `${label}: ${value}`;
}

function buildOptionalTimestamp(data, hora, isFim = false) {
    // Permite salvar apenas data ou apenas hora. Timestamp só existe quando há data.
    if (!data) return null;
    const finalHora = hora || (isFim ? '23:59' : '00:00');
    const d = new Date(`${data}T${finalHora}`);
    return isNaN(d.getTime()) ? null : d.getTime();
}

function getCategoriaTimestamp(c, prefix) {
    if (!c) return null;
    const existente = c[prefix];
    if (existente) return existente;
    return buildOptionalTimestamp(c[`${prefix}Data`] || '', c[`${prefix}Hora`] || '', prefix === 'fim');
}

function isCategoriaVisivelAgora(c) {
    if (!c || c.ativo === false) return false;

    const agora = Date.now();
    const inicio = getCategoriaTimestamp(c, 'inicio');
    const fim = getCategoriaTimestamp(c, 'fim');

    if (inicio && agora < inicio) return false;
    if (fim && agora > fim) return false;

    return true;
}


async function sincronizarCategoriasExpiradas() {
    const agora = Date.now();
    const expiradas = globalCategories.filter(c => {
        const fim = getCategoriaTimestamp(c, 'fim');
        return c && c.ativo !== false && fim && agora > Number(fim);
    });

    if (!expiradas.length) return false;

    try {
        await Promise.all(expiradas.map(c => updateDoc(doc(db, "categorias", c.id), {
            ativo: false,
            ocultoAutomaticoFim: true,
            atualizadoAutomaticamenteEm: Date.now()
        })));

        expiradas.forEach(c => {
            c.ativo = false;
            c.ocultoAutomaticoFim = true;
            c.atualizadoAutomaticamenteEm = Date.now();
        });

        return true;
    } catch (err) {
        console.error('Erro ao ocultar categorias com fim vencido:', err);
        return false;
    }
}

function getCategoriaStatusVisual(c) {
    const ativoManual = c?.ativo !== false;
    const visivelAgora = isCategoriaVisivelAgora(c);
    return {
        ativoManual,
        visivelAgora,
        statusClasse: visivelAgora ? 'ativo' : 'inativo',
        statusTexto: visivelAgora ? 'Ativa' : 'Oculta',
        toggleClasse: visivelAgora ? 'cat-toggle-visible' : 'cat-toggle-hidden',
        toggleIcone: visivelAgora ? 'eye' : 'eye-slash'
    };
}


function getCatScheduleFromForm(prefix) {
    const inicioData = document.getElementById(`${prefix}-inid`).value || '';
    const inicioHora = document.getElementById(`${prefix}-inih`).value || '';
    const fimData = document.getElementById(`${prefix}-fimd`).value || '';
    const fimHora = document.getElementById(`${prefix}-fimh`).value || '';

    return {
        inicioData,
        inicioHora,
        fimData,
        fimHora,
        inicio: buildOptionalTimestamp(inicioData, inicioHora, false),
        fim: buildOptionalTimestamp(fimData, fimHora, true)
    };
}

function orderedCategoriesList() {
    return [...globalCategories].sort((a, b) => {
        const ao = (a.ordem !== undefined && a.ordem !== null && Number.isFinite(Number(a.ordem))) ? Number(a.ordem) : null;
        const bo = (b.ordem !== undefined && b.ordem !== null && Number.isFinite(Number(b.ordem))) ? Number(b.ordem) : null;
        if (ao !== null && bo !== null && ao !== bo) return ao - bo;
        if (ao !== null && bo === null) return -1;
        if (ao === null && bo !== null) return 1;
        return window.sortAlfabetico(a.nome, b.nome);
    });
}

async function reorderCategoriesAlphabetically() {
    const snap = await getDocs(collection(db, "categorias"));
    const cats = [];
    snap.forEach(d => cats.push({ id: d.id, ...d.data() }));
    cats.sort((a, b) => window.sortAlfabetico(a.nome, b.nome));
    await Promise.all(cats.map((c, index) => updateDoc(doc(db, "categorias", c.id), { ordem: index })));
}

async function syncCats() {
    const snap = await getDocs(collection(db, "categorias"));
    globalCategories = []; snap.forEach(d => { const c = d.data(); c.id = d.id; globalCategories.push(c); });
    await sincronizarCategoriasExpiradas();
    window.renderCatsTable();
}


function sanitizeRichText(html) {
    const raw = (html || '').toString();
    const container = document.createElement('div');
    container.innerHTML = raw;

    const allowedTags = ['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN'];
    const allowedAlignments = ['left', 'right', 'center', 'justify'];
    const walk = document.createTreeWalker(container, NodeFilter.SHOW_ELEMENT, null);
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);

    nodes.forEach(node => {
        if (!allowedTags.includes(node.tagName)) {
            node.replaceWith(...Array.from(node.childNodes));
            return;
        }

        let textAlign = '';
        const styleAttr = node.getAttribute('style') || '';
        const styleMatch = styleAttr.match(/text-align\s*:\s*(left|right|center|justify)/i);
        const alignAttr = (node.getAttribute('align') || '').toLowerCase();
        if (styleMatch) textAlign = styleMatch[1].toLowerCase();
        if (!textAlign && allowedAlignments.includes(alignAttr)) textAlign = alignAttr;

        Array.from(node.attributes).forEach(attr => node.removeAttribute(attr.name));
        if (allowedAlignments.includes(textAlign)) node.style.textAlign = textAlign;
    });

    return container.innerHTML
        .replace(/<div><br><\/div>/gi, '<br>')
        .replace(/<p><br><\/p>/gi, '<br>')
        .trim();
}

window.focusCatEditor = function(prefix) {
    const editor = document.getElementById(`${prefix}-obs-editor`);
    if (editor) editor.focus();
};

window.execCatRichText = function(command, prefix) {
    const editor = prefix ? document.getElementById(`${prefix}-obs-editor`) : document.querySelector('.cat-rich-editor:focus');
    if (editor) editor.focus();
    document.execCommand(command, false, null);
};

window.getCatRichText = function(prefix) {
    const editor = document.getElementById(`${prefix}-obs-editor`);
    if (!editor) return document.getElementById(`${prefix}-obs`)?.value?.trim() || '';
    const html = sanitizeRichText(editor.innerHTML);
    const hidden = document.getElementById(`${prefix}-obs`);
    if (hidden) hidden.value = html;
    return html;
};

window.setCatRichText = function(prefix, value) {
    const editor = document.getElementById(`${prefix}-obs-editor`);
    const hidden = document.getElementById(`${prefix}-obs`);
    const safe = sanitizeRichText(value || '');
    if (editor) editor.innerHTML = safe;
    if (hidden) hidden.value = safe;
};

// ==========================================
// EDITOR RICO DE COMUNICADOS
// ==========================================
window.focusAvisoEditor = function(prefix) {
    const editor = document.getElementById(`${prefix}-txt-editor`);
    if (editor) editor.focus();
};

window.execAvisoRichText = function(command, prefix) {
    const editor = document.getElementById(`${prefix}-txt-editor`);
    if (editor) editor.focus();
    document.execCommand(command, false, null);
};

window.getAvisoRichText = function(prefix) {
    const editor = document.getElementById(`${prefix}-txt-editor`);
    const hidden = document.getElementById(`${prefix}-txt`);
    const html = editor ? sanitizeRichText(editor.innerHTML) : (hidden?.value || '').trim();
    if (hidden) hidden.value = html;
    return html;
};

window.setAvisoRichText = function(prefix, value) {
    const editor = document.getElementById(`${prefix}-txt-editor`);
    const hidden = document.getElementById(`${prefix}-txt`);
    const safe = sanitizeRichText(value || '');
    if (editor) editor.innerHTML = safe;
    if (hidden) hidden.value = safe;
};

window.setAvisoImagePosition = function(prefix, value) {
    const input = document.getElementById(`${prefix}-img-pos`);
    if (input) input.value = value;
    ['top', 'bottom'].forEach(pos => {
        const btn = document.getElementById(`${prefix}-img-pos-${pos}`);
        if (btn) btn.classList.toggle('active', pos === value);
    });
};

function formatAvisoScheduleLine(label, timestamp) {
    if (!timestamp || isNaN(Number(timestamp))) return '';
    const d = new Date(Number(timestamp));
    if (isNaN(d.getTime())) return '';
    const data = d.toLocaleDateString('pt-BR');
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${label}: ${data} | ${hora}`;
}

function renderAvisoScheduleHtml(a) {
    const linhas = [
        formatAvisoScheduleLine('Início', a.inicio),
        formatAvisoScheduleLine('Fim', a.fim)
    ].filter(Boolean);
    return linhas.length ? linhas.map(l => `<span class="aviso-period-line">${l}</span>`).join('') : '<span class="aviso-period-line">-</span>';
}

function getAvisoScheduleValue(timestamp) {
    if (!timestamp || isNaN(Number(timestamp))) return '-';
    const d = new Date(Number(timestamp));
    if (isNaN(d.getTime())) return '-';
    return `${d.toLocaleDateString('pt-BR')} | ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}


function buildOptionalAvisoTimestamp(data, hora, isFim = false) {
    if (!data) return null;
    const finalHora = hora || (isFim ? '23:59' : '00:00');
    const d = new Date(`${data}T${finalHora}`);
    return isNaN(d.getTime()) ? null : d.getTime();
}

function getAvisoScheduleFromForm(prefix) {
    const inicioData = document.getElementById(`${prefix}-inid`).value || '';
    const inicioHora = document.getElementById(`${prefix}-inih`).value || '';
    const fimData = document.getElementById(`${prefix}-fimd`).value || '';
    const fimHora = document.getElementById(`${prefix}-fimh`).value || '';
    return {
        inicio: buildOptionalAvisoTimestamp(inicioData, inicioHora, false),
        fim: buildOptionalAvisoTimestamp(fimData, fimHora, true)
    };
}

function setAvisoScheduleFields(prefix, inicio, fim) {
    const setParts = (base, timestamp) => {
        const dataEl = document.getElementById(`${prefix}-${base}d`);
        const horaEl = document.getElementById(`${prefix}-${base}h`);
        if (!timestamp || isNaN(Number(timestamp))) {
            if (dataEl) dataEl.value = '';
            if (horaEl) horaEl.value = '';
            return;
        }
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const d = new Date(Number(timestamp) - tzOffset);
        if (isNaN(d.getTime())) return;
        if (dataEl) dataEl.value = d.toISOString().split('T')[0];
        if (horaEl) horaEl.value = d.toISOString().split('T')[1].slice(0, 5);
    };
    setParts('ini', inicio);
    setParts('fim', fim);
}

function getAvisoStatus(a) {
    const isAtivo = a.ativo !== false;
    const agora = Date.now();
    const inicio = Number(a.inicio) || 0;
    const fim = Number(a.fim) || 0;
    if (!isAtivo) return { st: 'Oculto', stClass: 'inativo', grupo: 'inativos' };
    if (inicio && agora < inicio) return { st: 'Agendado', stClass: 'agendado', grupo: 'ativos' };
    if (!fim || agora <= fim) return { st: 'Andamento', stClass: 'ativo', grupo: 'ativos' };
    return { st: 'Concluso', stClass: 'concluso', grupo: 'inativos' };
}

function orderedAvisosList() {
    return [...allAvisos].sort((a, b) => {
        const ao = (a.ordem !== undefined && a.ordem !== null && Number.isFinite(Number(a.ordem))) ? Number(a.ordem) : null;
        const bo = (b.ordem !== undefined && b.ordem !== null && Number.isFinite(Number(b.ordem))) ? Number(b.ordem) : null;
        if (ao !== null && bo !== null && ao !== bo) return ao - bo;
        if (ao !== null && bo === null) return -1;
        if (ao === null && bo !== null) return 1;
        return (Number(a.inicio) || 0) - (Number(b.inicio) || 0);
    });
}

window.switchAvisosTab = function(tab) {
    currentAvisosTab = tab === 'inativos' ? 'inativos' : 'ativos';
    document.getElementById('tab-avisos-ativos')?.classList.toggle('active', currentAvisosTab === 'ativos');
    document.getElementById('tab-avisos-inativos')?.classList.toggle('active', currentAvisosTab === 'inativos');
    window.clearSelection('avisos');
    window.renderAvisosTable();
};

function renderClickableAvisoImage(url, className = 'img-preview') {
    if (!url) return '';
    const safeUrl = escapeHTML(url);
    return `<img src="${safeUrl}" class="${className} aviso-clickable-img" alt="Imagem do comunicado" title="Clique para ampliar" style="cursor:pointer;" onclick="event.stopPropagation(); window.openAvisoImagePreview(this.src)">`;
}

window.openAvisoImagePreview = function(url) {
    if (!url) return;

    let modal = document.getElementById('modal-preview-aviso-img');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'modal-preview-aviso-img';
        modal.className = 'modal';
        modal.style.zIndex = '100001';
        modal.onclick = function(event) {
            if (event.target === modal) window.closeAvisoImagePreview();
        };

        modal.innerHTML = `
            <div class="popup-conteudo" style="max-width: 920px; padding: 22px; position: relative;">
                <button class="close-modal" style="position:absolute; right:18px; top:12px;" onclick="window.closeAvisoImagePreview()">&times;</button>
                <img id="aviso-img-preview-expanded" alt="Imagem do comunicado ampliada" style="display:block; max-width:100%; max-height:75vh; object-fit:contain; border-radius:16px; margin:0 auto;">
            </div>
        `;
        document.body.appendChild(modal);
    }

    const img = document.getElementById('aviso-img-preview-expanded');
    if (img) img.src = url;

    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('show'), 10);
};

window.closeAvisoImagePreview = function() {
    const modal = document.getElementById('modal-preview-aviso-img');
    if (!modal) return;
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
        const img = document.getElementById('aviso-img-preview-expanded');
        if (img) img.src = '';
    }, 300);
};

function buildAvisoMobilePreview(a) {
    const pos = a.posicaoImagem || 'top';
    const avisoImgsMobile = window.getAvisoImagens(a);
    const img = avisoImgsMobile.length ? renderClickableAvisoImage(avisoImgsMobile[0], '') : '';
    const texto = sanitizeRichText(a.texto || '') || '-';
    return `<div class="aviso-mobile-preview aviso-img-${pos}">${pos === 'top' ? img : ''}<div class="aviso-mobile-text">${texto}</div>${pos === 'bottom' ? img : ''}</div>`;
}


function escapeHTML(value) {
    return (value || '').toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function stripCatNotice(value) {
    const temp = document.createElement('div');
    temp.innerHTML = sanitizeRichText(value || '');
    return (temp.textContent || temp.innerText || '').replace(/\s+/g, ' ').trim();
}

function renderCatNoticeBadge(value) {
    const hasNotice = !!stripCatNotice(value);
    return `<span class="badge cat-notice-badge ${hasNotice ? 'ativo' : 'inativo'}">${hasNotice ? 'Possui' : 'Não possui'}</span>`;
}

function renderCatNoticeSummary(value) {
    return renderCatNoticeBadge(value);
}

function renderCatNoticeStatus(value) {
    return renderCatNoticeBadge(value);
}

window.renderCatsTable = function() {
    const tb = document.querySelector('#tbl-categorias tbody');
    tb.innerHTML = "";
    let opts = `<option value="">Selecione...</option>`;
    const searchTerm = document.getElementById('search-cat').value.toLowerCase();

    const sorted = orderedCategoriesList();
    sorted.forEach(c => { opts += `<option value="${c.nome}">${c.nome}</option>`; });

    sorted
        .filter(c => {
            const statusBusca = getCategoriaStatusVisual(c).visivelAgora ? 'ativa' : 'oculta';
            return `${c.nome} ${c.minTotal||0} ${c.tipoColuna} ${c.mensagemObs||''} ${statusBusca} ${getScheduleParts(c, 'inicio').data} ${getScheduleParts(c, 'fim').data}`.toLowerCase().includes(searchTerm);
        })
        .forEach(c => {
            const catStatusVisual = getCategoriaStatusVisual(c);
            const isAtivo = catStatusVisual.visivelAgora;
            const ativoManual = catStatusVisual.ativoManual;
            const ini = getScheduleParts(c, 'inicio');
            const fim = getScheduleParts(c, 'fim');
            const iniData = normalizeDateBR(ini.data);
            const fimData = normalizeDateBR(fim.data);
            const iniResumo = formatScheduleValue(ini.data, ini.hora);
            const fimResumo = formatScheduleValue(fim.data, fim.hora);
            const programacaoLinhas = [
                formatScheduleLine('Início', ini.data, ini.hora),
                formatScheduleLine('Fim', fim.data, fim.hora)
            ].filter(Boolean);
            const programacaoHtml = programacaoLinhas.length
                ? programacaoLinhas.map(linha => `<span class="cat-period-line">${linha}</span>`).join('')
                : '<span class="cat-period-line">-</span>';

            tb.innerHTML += `<tr data-cat-id="${c.id}" class="cat-row">
                <td class="cat-order-cell" data-label="Ordem:" style="text-align:center;"><button type="button" class="cat-drag-handle" title="Arrastar para reorganizar" onpointerdown="window.catPointerDown(event, '${c.id}')"><i class="fas fa-grip-lines"></i></button></td>
                <td class="cat-select-cell" data-label="Selecionar:" style="text-align:center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${c.id}" onchange="window.checkSelection('categorias')"></td>
                <td class="cat-name-cell" data-label="Categoria:" onpointerdown="window.catMobilePointerDown(event, '${c.id}')"><strong style="color:var(--favu-rust); font-size:1.1rem;">${c.nome}</strong></td>
                <td class="cat-min-cell" data-label="Mínimo:">${c.minTotal ?? 0}</td>
                <td class="cat-medida-cell" data-label="Medida:">${c.tipoColuna || '-'}</td>
                <td class="cat-notice-cell" data-label="Aviso:"><small class="cat-notice-summary"><span class="cat-notice-desktop">${renderCatNoticeSummary(c.mensagemObs)}</span><span class="cat-notice-mobile">${renderCatNoticeStatus(c.mensagemObs)}</span></small></td>
                <td class="cat-period-cell desktop-schedule-cell" data-label="Programação:">
                    ${programacaoHtml}
                </td>
                <td class="cat-mobile-start mobile-schedule-cell" data-label="Início:">${iniResumo}</td>
                <td class="cat-mobile-end mobile-schedule-cell" data-label="Fim:">${fimResumo}</td>
                <td class="cat-status-cell" data-label="Status:"><span class="badge ${catStatusVisual.statusClasse}">${catStatusVisual.statusTexto}</span></td>
                <td class="cat-actions-cell" data-label="Ações:">
                    <div class="action-btns-wrapper">
                        <button class="btn-action edit" onclick="window.openEditCat('${c.id}')"><i class="fas fa-pencil-alt"></i></button>
                        <button class="btn-action copy" title="Copiar categoria" onclick="window.copyCat('${c.id}')"><i class="fas fa-copy"></i></button>
                        <button class="btn-action toggle ${catStatusVisual.toggleClasse}" onclick="window.togC('${c.id}', ${!ativoManual})"><i class="fas fa-${catStatusVisual.toggleIcone}"></i></button>
                        <button class="btn-action del" onclick="window.delC('${c.id}')"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        });

    document.querySelectorAll('.cat-select').forEach(sel => {
        const v = sel.value;
        sel.innerHTML = opts;
        sel.value = v;
    });
}

let draggingCategoryId = null;

window.catDragStart = function(event, id) {
    if (!event.target.closest('.cat-drag-handle')) {
        event.preventDefault();
        return;
    }
    draggingCategoryId = id;
    event.currentTarget.classList.add('cat-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
};

window.catDragOver = function(event) {
    event.preventDefault();
    const draggingRow = document.querySelector('#tbl-categorias tr.cat-dragging');
    const overRow = event.currentTarget;
    if (!draggingRow || draggingRow === overRow) return;
    const tbody = overRow.parentNode;
    const rect = overRow.getBoundingClientRect();
    const insertAfter = (event.clientY - rect.top) > rect.height / 2;
    tbody.insertBefore(draggingRow, insertAfter ? overRow.nextSibling : overRow);
};

window.catDrop = function(event) {
    event.preventDefault();
};

window.catDragEnd = async function(event) {
    event.currentTarget.classList.remove('cat-dragging');
    const rows = Array.from(document.querySelectorAll('#tbl-categorias tbody tr[data-cat-id]'));
    const ids = rows.map(row => row.dataset.catId);
    if (!ids.length || !draggingCategoryId) return;

    ids.forEach((id, index) => {
        const cat = globalCategories.find(c => c.id === id);
        if (cat) cat.ordem = index;
    });

    try {
        await Promise.all(ids.map((id, index) => updateDoc(doc(db, "categorias", id), { ordem: index })));
    } catch (err) {
        console.error('Erro ao salvar ordem das categorias:', err);
        customAlert('Não foi possível salvar a nova ordem das categorias.', 'Atenção');
        syncCats();
    } finally {
        draggingCategoryId = null;
    }
};


let catPointerDrag = null;

function persistCategoryOrderFromDOM() {
    const rows = Array.from(document.querySelectorAll('#tbl-categorias tbody tr[data-cat-id]'));
    const ids = rows.map(row => row.dataset.catId);
    ids.forEach((id, index) => {
        const cat = globalCategories.find(c => c.id === id);
        if (cat) cat.ordem = index;
    });
    return Promise.all(ids.map((id, index) => updateDoc(doc(db, "categorias", id), { ordem: index })));
}

function startCategoryPointerSort(event, id, options = {}) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const handle = event.currentTarget;
    const row = handle.closest('tr[data-cat-id]');
    const tbody = row ? row.parentElement : null;
    if (!row || !tbody) return;

    if (event.target.closest('input, select, textarea, button:not(.cat-drag-handle), .btn-action, a')) return;

    event.preventDefault();
    event.stopPropagation();

    const delay = options.delay || 0;
    const startX = event.clientX;
    const startY = event.clientY;
    let active = false;
    let didMove = false;
    let cancelled = false;
    let timer = null;

    const begin = () => {
        if (active || cancelled) return;
        active = true;
        draggingCategoryId = id;
        catPointerDrag = { row, id };
        row.classList.add('cat-dragging');
        document.body.classList.add('cat-sorting-active');
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
    };

    const moveRowByPointer = (clientY) => {
        const rows = Array.from(tbody.querySelectorAll('tr[data-cat-id]')).filter(r => r !== row);
        if (!rows.length) return;

        for (const targetRow of rows) {
            const rect = targetRow.getBoundingClientRect();
            const middle = rect.top + rect.height / 2;
            if (clientY < middle) {
                if (row.nextElementSibling !== targetRow) tbody.insertBefore(row, targetRow);
                return;
            }
        }
        tbody.appendChild(row);
    };

    const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener('pointermove', onMove, true);
        document.removeEventListener('pointerup', onUp, true);
        document.removeEventListener('pointercancel', onUp, true);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    };

    const cancelBeforeStart = () => {
        cancelled = true;
        cleanup();
    };

    const onMove = (moveEvent) => {
        const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);

        if (!active) {
            // Em telas não desktop, permite clicar/segurar e mover a categoria.
            // Antes o movimento antes do timeout cancelava o drag, deixando a linha travada.
            if (delay && dist > 8) {
                begin();
            } else if (!delay) {
                begin();
            } else {
                return;
            }
        }

        didMove = true;
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        moveRowByPointer(moveEvent.clientY);
    };

    const onUp = async (upEvent) => {
        cleanup();
        if (!active) return;

        upEvent.preventDefault();
        upEvent.stopPropagation();

        row.classList.remove('cat-dragging');
        document.body.classList.remove('cat-sorting-active');
        catPointerDrag = null;

        try {
            if (didMove) await persistCategoryOrderFromDOM();
        } catch (err) {
            console.error('Erro ao salvar ordem das categorias:', err);
            customAlert('Não foi possível salvar a nova ordem das categorias.', 'Atenção');
            syncCats();
        } finally {
            draggingCategoryId = null;
        }
    };

    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);

    if (delay) timer = setTimeout(begin, delay);
    else begin();
}

window.catPointerDown = function(event, id) {
    event.preventDefault();
    startCategoryPointerSort(event, id, { delay: 0 });
};

window.catMobilePointerDown = function(event, id) {
    if (window.innerWidth > 1024) return;
    event.preventDefault();
    startCategoryPointerSort(event, id, { delay: 280 });
};


// Atualiza a tabela automaticamente quando uma categoria chega na data/hora de fim.
if (!window.__catFimAutoTimer) {
    window.__catFimAutoTimer = setInterval(async () => {
        try {
            if (!Array.isArray(globalCategories) || !globalCategories.length) return;
            const mudou = await sincronizarCategoriasExpiradas();
            if (mudou) window.renderCatsTable();
        } catch (e) {
            console.warn('Falha ao verificar fim de categorias:', e);
        }
    }, 30000);
}

document.getElementById('form-add-cat').onsubmit = async(e) => {
    e.preventDefault(); 
    const nm = document.getElementById('ac-nome').value.trim();
    const schedule = getCatScheduleFromForm('ac');
    const agendar = !!(schedule.inicioData || schedule.inicioHora || schedule.fimData || schedule.fimHora);

    await setDoc(doc(db, "categorias", nm.toLowerCase().replace(/\s/g, '-')), { 
        nome: nm, 
        minTotal: parseInt(document.getElementById('ac-min').value)||0, 
        tipoColuna: document.getElementById('ac-col').value, 
        mensagemObs: window.getCatRichText('ac'), 
        ativo: true, 
        minIndividual: true,
        agendarVisibilidade: agendar,
        ...schedule
    }); 
    await reorderCategoriesAlphabetically();
    customAlert("Categoria Criada!"); window.closeModal('modal-add-cat', 'form-add-cat'); syncCats();
};

window.openEditCat = async(id) => {
    const c = (await getDoc(doc(db, "categorias", id))).data();
    document.getElementById('ec-id').value = id; 
    document.getElementById('ec-nome').value = c.nome;
    document.getElementById('ec-min').value = c.minTotal; 
    document.getElementById('ec-col').value = c.tipoColuna;
    window.setCatRichText('ec', c.mensagemObs || ''); 
    
    const ini = getScheduleParts(c, 'inicio');
    const fim = getScheduleParts(c, 'fim');
    document.getElementById('ec-inid').value = ini.data || '';
    document.getElementById('ec-inih').value = ini.hora || '';
    document.getElementById('ec-fimd').value = fim.data || '';
    document.getElementById('ec-fimh').value = fim.hora || '';

    window.openModal('modal-editar-cat');
};

document.getElementById('form-edit-cat').onsubmit = async(e) => {
    e.preventDefault();
    
    const schedule = getCatScheduleFromForm('ec');
    const agendar = !!(schedule.inicioData || schedule.inicioHora || schedule.fimData || schedule.fimHora);

    await updateDoc(doc(db, "categorias", document.getElementById('ec-id').value), { 
        nome: document.getElementById('ec-nome').value.trim(), 
        minTotal: parseInt(document.getElementById('ec-min').value)||0, 
        tipoColuna: document.getElementById('ec-col').value, 
        mensagemObs: window.getCatRichText('ec'),
        agendarVisibilidade: agendar,
        ...schedule
    });
    customAlert("Categoria Atualizada!"); window.closeModal('modal-editar-cat', 'form-edit-cat'); syncCats(); loadProds();
};
window.togC = async(id, s) => { 
    const payload = { ativo: s };
    if (s) {
        payload.ocultoAutomaticoFim = false;
        payload.atualizadoAutomaticamenteEm = null;
    }
    await updateDoc(doc(db, "categorias", id), payload); 
    const index = globalCategories.findIndex(c => c.id === id);
    if(index > -1) {
        globalCategories[index].ativo = s;
        if (s) {
            globalCategories[index].ocultoAutomaticoFim = false;
            globalCategories[index].atualizadoAutomaticamenteEm = null;
        }
    }
    await sincronizarCategoriasExpiradas();
    window.renderCatsTable(); 
};

window.delC = async(id) => { 
    customConfirm("Excluir categoria?", async () => { 
        await deleteDoc(doc(db, "categorias", id)); 
        globalCategories = globalCategories.filter(c => c.id !== id);
        window.renderCatsTable(); 
    }); 
};


window.copyCat = async function(id) {
    try {
        const origemSnap = await getDoc(doc(db, "categorias", id));
        if (!origemSnap.exists()) {
            customAlert("Categoria não encontrada para copiar.", "Atenção");
            return;
        }

        const origem = origemSnap.data();
        const nomesUsados = new Set(globalCategories.map(c => (c.nome || '').trim().toLowerCase()));
        const baseNome = `${origem.nome || 'Categoria'} (cópia)`;
        let novoNome = baseNome;
        let contador = 2;
        while (nomesUsados.has(novoNome.trim().toLowerCase())) {
            novoNome = `${baseNome} ${contador}`;
            contador++;
        }

        const ordered = orderedCategoriesList();
        const originalIndex = ordered.findIndex(c => c.id === id);
        const novaOrdem = originalIndex >= 0 ? originalIndex + 1 : ordered.length;

        const catsParaAtualizar = ordered
            .filter((c, index) => index >= novaOrdem)
            .map((c, index) => updateDoc(doc(db, "categorias", c.id), { ordem: novaOrdem + index + 1 }));

        await Promise.all(catsParaAtualizar);

        await addDoc(collection(db, "categorias"), {
            ...origem,
            nome: novoNome,
            ordem: novaOrdem
        });

        customAlert("Categoria copiada!");
        syncCats();
        loadProds();
    } catch (err) {
        console.error("Erro ao copiar categoria:", err);
        customAlert("Não foi possível copiar a categoria.", "Atenção");
    }
};

document.getElementById('a-cat').addEventListener('change', function() {
    const catObj = globalCategories.find(c => c.nome === this.value);
    const isSizeCategory = catObj && catObj.tipoColuna === 'Tamanho';
    document.getElementById('variations-container').innerHTML = '';
    window.addVariation(isSizeCategory);
    document.getElementById('btn-add-variation').style.display = isSizeCategory ? 'block' : 'none';
});

window.addVariation = (isSizeCategory = true, isMixed = false) => {
    const container = document.getElementById('variations-container');
    if (!container) return; 
    const div = document.createElement('div');
    div.className = 'variation-block';
    div.style = "background: rgba(224, 159, 65, 0.05); padding: 15px; border-radius: 10px; margin-bottom: 15px; border: 1px dashed rgba(224, 159, 65, 0.3); position: relative;";
    const btnRemove = (isSizeCategory && container.children.length > 0) ? `<button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: white; color: #E60000; border: 1px solid #E60000; border-radius: 5px; font-size: 0.8rem; cursor: pointer; padding: 2px 8px;">Remover <i class="fas fa-times"></i></button>` : '';
    
    const req = isMixed ? '' : 'required';
    const labelSize = isMixed ? 'Tamanho (Vazio = Mín)' : 'Tamanho';
    
    const sizeFieldHtml = isSizeCategory ? `<div><label>${labelSize}</label><input type="text" class="v-tam" placeholder="Ex: P, M" ${req}></div>` : `<div style="display:none;"><input type="hidden" class="v-tam" value=""></div>`;

    div.innerHTML = `${btnRemove}
        <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); margin-bottom: 0;">
            ${sizeFieldHtml}
            <div><label>Mínimo por Produto</label><input type="number" class="v-min" placeholder="Ex: 10"></div>
            <div><label>Preço (R$)</label><input type="number" step="0.01" class="v-preco" required style="font-family: var(--font-numbers) !important;"></div>
        </div>`;
    container.appendChild(div);
};

document.getElementById('a-cat').addEventListener('change', function() {
    const catObj = globalCategories.find(c => c.nome === this.value);
    const isSizeCategory = catObj && (catObj.tipoColuna === 'Tamanho' || catObj.tipoColuna === 'Tamanho/Minimo');
    const isMixed = catObj && catObj.tipoColuna === 'Tamanho/Minimo';
    
    document.getElementById('variations-container').innerHTML = '';
    window.addVariation(isSizeCategory, isMixed);
    document.getElementById('btn-add-variation').style.display = isSizeCategory ? 'block' : 'none';
});

window.handleBulkCategoryChange = (selectElement) => {
    const catObj = globalCategories.find(c => c.nome === selectElement.value);
    const container = selectElement.closest('.grid-row').querySelector('.b-variations-container');
    const addBtn = container.querySelector('.add-bulk-var-btn');
    const tamInputs = container.querySelectorAll('.b-tam');

    if (catObj && (catObj.tipoColuna === 'Tamanho' || catObj.tipoColuna === 'Tamanho/Minimo')) {
        tamInputs.forEach(i => { 
            i.disabled = false; 
            i.placeholder = catObj.tipoColuna === 'Tamanho/Minimo' ? "Tam (Vazio = Mín)" : "Tam"; 
            i.type = "text"; 
        });
        if(addBtn) addBtn.style.display = 'inline-block';
    } else {
        const varRows = container.querySelectorAll('.b-var-row');
        if(varRows.length > 1) for(let i=1; i<varRows.length; i++) varRows[i].remove();
        tamInputs.forEach(i => { i.disabled = true; i.value = ""; i.placeholder = "-"; });
        if(addBtn) addBtn.style.display = 'none';
    }
};

window.addBulkVariation = (btn) => {
    const div = document.createElement('div'); div.className = 'b-var-row'; div.style = "display:flex; gap:5px; align-items:center; margin-top:5px;";
    div.innerHTML = `<input type="text" class="b-tam" placeholder="Tam" style="width:60px;"><input type="number" step="0.01" class="b-preco" placeholder="R$" style="width:75px; font-family: var(--font-numbers) !important;"><input type="text" class="b-dres" placeholder="Desc. Resumo" style="flex:1;"><button type="button" onclick="this.parentElement.remove()" style="background:#fcc; border:none; border-radius:4px; cursor:pointer; width:28px; height:28px; font-weight:bold; color:#E60000;">&times;</button>`;
    btn.closest('.b-variations-container').appendChild(div);
};

window.addGridRow = () => {
    const d = document.createElement('div'); d.className = 'grid-row';
    let opts = `<option value="">Categoria...</option>`; globalCategories.forEach(cat => opts += `<option value="${cat.nome}">${cat.nome}</option>`);
    d.innerHTML = `<div><label class="bulk-file-upload"><i class="fas fa-camera" style="font-size: 1.2rem;"></i><input type="file" class="b-file" accept="image/*" onchange="this.parentElement.classList.add('has-file');"></label></div>
        <div><select class="b-cat cat-select" onchange="window.handleBulkCategoryChange(this)">${opts}</select></div>
        <div><textarea class="b-nome" rows="1" placeholder="Nome Produto"></textarea></div>
        <div><input type="number" class="b-min" value="1" style="font-family: var(--font-numbers) !important;"></div>
        <div><textarea class="b-dmenu" rows="2" placeholder="Desc. Produto"></textarea></div><div><textarea class="b-dpop" rows="2" placeholder="Desc. Imagem"></textarea></div>
        <div class="b-variations-container" style="display:flex; flex-direction:column;">
            <div class="b-var-row" style="display:flex; gap:5px; align-items:center;">
                <input type="text" class="b-tam" placeholder="(P - 1,5KG)" style="width:60px;" disabled><input type="number" step="0.01" class="b-preco" placeholder="R$" style="width:75px; font-family: var(--font-numbers) !important;"><input type="text" class="b-dres" placeholder="Desc. Resumo" style="flex:1;">
                <button type="button" class="add-bulk-var-btn" onclick="window.addBulkVariation(this)" style="background:#eee; border:none; border-radius:4px; cursor:pointer; width:28px; height:28px; font-weight:bold; color:var(--favu-rust); display:none;">+</button>
            </div>
        </div>
        <div style="display:flex; justify-content:center; padding-top:5px;"><button type="button" onclick="this.parentElement.remove()" style="background:none; color:#E60000; border:none; cursor:pointer; font-size:1.4rem;"><i class="fas fa-times-circle"></i></button></div>`;
    document.getElementById('bulk-rows').appendChild(d);
};

window.saveBulkItems = async() => {
    const btn = document.getElementById('btn-save-bulk'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subindo lote...'; 
    btn.disabled = true;
    
    try {
        const rows = Array.from(document.querySelectorAll('#bulk-rows .grid-row'));
        
        const promessas = rows.map(async (r) => {
            const nm = r.querySelector('.b-nome').value.trim(); 
            if(!nm) return; 
            
            let url = ""; 
            const f = r.querySelector('.b-file').files[0]; 
            if(f) url = await upImg(f); 
            
            const vars = Array.from(r.querySelectorAll('.b-var-row'));
            
            const varPromises = vars.map(vr => {
                return addDoc(collection(db, "produtos"), { 
                    nome: nm, 
                    categoria: r.querySelector('.b-cat').value, 
                    min: parseInt(r.querySelector('.b-min').value)||1, 
                    descricaoItem: r.querySelector('.b-dmenu').value.trim(), 
                    descricaoPopup: r.querySelector('.b-dpop').value.trim(), 
                    imagemUrl: url, 
                    ativo: true, 
                    tamanho: vr.querySelector('.b-tam').value.trim(), 
                    preco: parseFloat(vr.querySelector('.b-preco').value)||0, 
                    descricaoResumo: vr.querySelector('.b-dres').value.trim() 
                });
            });
            
            return Promise.all(varPromises);
        });

        await Promise.all(promessas);

        customAlert("Lote adicionado com sucesso!"); 
        document.getElementById('bulk-rows').innerHTML = ''; 
        window.closeModal('modal-bulk-prod'); 
        loadProds(); 
        
    } catch(err) { 
        console.error(err);
        customAlert("Erro ao salvar lote.", "Erro"); 
    } finally { 
        btn.innerHTML = 'Salvar'; 
        btn.disabled = false; 
    }
};

document.getElementById('search-prod').addEventListener('input', () => { window.renderProdsTable(); });

async function loadProds() {
    const s = await getDocs(collection(db, "produtos"));
    allProducts = []; s.forEach(d => allProducts.push({id: d.id, ...d.data()}));
    renderProdTabs(); window.renderProdsTable(); window.renderOrcamentoMenu(); 
}

function renderProdTabs() {
    const container = document.getElementById('prod-cats-nav');
    
    const catsUsed = [...new Set(allProducts.map(p => p.categoria || 'Sem Categoria'))].sort(window.sortAlfabetico);
    
    if (!currentCategoryFilter || !catsUsed.includes(currentCategoryFilter)) currentCategoryFilter = catsUsed[0] || '';
    let html = ''; catsUsed.forEach(c => html += `<button class="prod-tab-btn ${currentCategoryFilter === c ? 'active' : ''}" onclick="window.filterProds('${c}')">${c}</button>`);
    container.innerHTML = html;
}

window.filterProds = function(cat) { currentCategoryFilter = cat; renderProdTabs(); window.renderProdsTable(); }

window.renderProdsTable = function() {
    const searchTerm = document.getElementById('search-prod').value.toLowerCase();
    const tb = document.querySelector("#tbl-produtos tbody"); tb.innerHTML = "";
    
    let filtered = searchTerm ? allProducts.filter(p => `${p.nome} ${p.categoria} ${p.tamanho||''} ${p.min||1} ${p.preco} ${p.descricaoItem||''} ${p.descricaoResumo||''} ${p.descricaoPopup||''} ${p.ativo?'visível':'oculto'}`.toLowerCase().includes(searchTerm)) : allProducts.filter(p => (p.categoria || 'Sem Categoria') === currentCategoryFilter);
    let chaveAtual = null;

    // EMPTY STATE DA TABELA AQUI!
    if (filtered.length === 0) {
        tb.innerHTML = `<tr><td colspan="12" style="text-align:center; padding: 50px 20px; color: #999; font-family: var(--font-numbers); font-size: 1.1rem;"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum produto encontrado por aqui.</td></tr>`;
        return;
    }
    
    filtered.sort(sortProducts).forEach((p) => {
        const imagensProduto = window.getProdutoImagens(p);
        const imgTag = window.renderAutoCarouselAdmin(imagensProduto, 'prod-table-carousel');
        const isNewGroup = p.nome !== chaveAtual; if(isNewGroup) chaveAtual = p.nome;

        tb.innerHTML += `<tr class="${isNewGroup ? 'group-separator-top' : ''}">
            <td data-label="Sel:" style="text-align: center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${p.id}" onchange="window.checkSelection('produtos')"></td>
            <td data-label="Foto:">${imgTag}</td><td data-label="Nome:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${p.nome}</strong></td>
            <td data-label="Categoria:">${p.categoria}</td><td data-label="Tam:">${p.tamanho||'-'}</td><td data-label="Mín:">${p.min||1}</td>
            <td data-label="Preço:">R$ ${(Number(p.preco) || 0).toFixed(2)}</td><td data-label="Desc. Produto:"><small>${p.descricaoItem ? window.formatText(p.descricaoItem) : '-'}</small></td>
            <td data-label="Desc. Resumo:"><small>${p.descricaoResumo ? window.formatText(p.descricaoResumo) : '-'}</small></td><td data-label="Desc. Imagem:"><small>${p.descricaoPopup ? window.formatText(p.descricaoPopup) : '-'}</small></td>
            <td data-label="Status:"><span class="badge ${p.ativo?'ativo':'inativo'}">${p.ativo?'Visível':'Oculto'}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditor('${p.id}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action toggle" onclick="window.togP('${p.id}', ${!p.ativo})"><i class="fas fa-${p.ativo?'eye':'eye-slash'}"></i></button>
                    <button class="btn-action del" onclick="window.delP('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
    setTimeout(() => window.iniciarCarrosseisAutomaticosAdmin(document.getElementById('tbl-produtos')), 80);
}

document.getElementById('form-add-prod').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        const urlsProduto = await window.uploadProdutoImagens('a-file');
        const url = urlsProduto[0] || "";
        const nomeBase = document.getElementById('a-nome').value.trim();
        const categoriaBase = document.getElementById('a-cat').value;
        const descMenuBase = document.getElementById('a-dmenu').value.trim();
        const descPopupBase = document.getElementById('a-dpop').value.trim();
        
        // Agora lê a Descrição do Resumo do novo campo que colocamos lá em cima
        const descResumoBase = document.getElementById('a-dres').value.trim(); 

        for(let v of document.querySelectorAll('.variation-block')) {
            // Agora lê o Mínimo de dentro do próprio bloco de variação (lado a lado com o tamanho)
            const minInput = v.querySelector('.v-min');
            const minVariation = minInput && minInput.value ? parseInt(minInput.value) : 1; 
            
            await addDoc(collection(db, "produtos"), {
                nome: nomeBase, categoria: categoriaBase, min: minVariation, 
                descricaoItem: descMenuBase, descricaoPopup: descPopupBase, 
                imagemUrl: url, imagensUrls: urlsProduto, ativo: true, tamanho: v.querySelector('.v-tam').value.trim(), 
                preco: parseFloat(v.querySelector('.v-preco').value)||0, descricaoResumo: descResumoBase
            });
        }
        customAlert("Item(ns) Adicionado(s)!"); window.limparListaImagensUpload?.('a-file');
        window.closeModal('modal-add-prod', 'form-add-prod'); loadProds();
    } catch(err) { console.error(err); customAlert("Erro ao salvar.", "Erro"); } finally { btn.innerHTML = 'Salvar Novo Produto'; btn.disabled = false; }
};


window.openEditor = async function(id) {
    try {
        const snap = await getDoc(doc(db, "produtos", id));
        if (!snap.exists()) {
            customAlert("Produto não encontrado.", "Erro");
            return;
        }

        const p = snap.data();
        const catSelect = document.getElementById('e-cat');

        // Garante que a categoria do produto exista no select, mesmo se a lista ainda não tiver sincronizado.
        if (p.categoria && catSelect && !Array.from(catSelect.options).some(opt => opt.value === p.categoria)) {
            const opt = document.createElement('option');
            opt.value = p.categoria;
            opt.textContent = p.categoria;
            catSelect.appendChild(opt);
        }

        document.getElementById('e-id').value = id;
        document.getElementById('e-nome').value = p.nome || '';
        document.getElementById('e-cat').value = p.categoria || '';
        document.getElementById('e-tam').value = p.tamanho || '';
        document.getElementById('e-min').value = p.min || 1;
        document.getElementById('e-preco').value = Number(p.preco) || 0;
        document.getElementById('e-dmenu').value = p.descricaoItem || '';
        document.getElementById('e-dres').value = p.descricaoResumo || '';
        document.getElementById('e-dpop').value = p.descricaoPopup || '';

        document.getElementById('e-file').value = '';
        document.getElementById('e-file-name').textContent = '';
        document.getElementById('e-remove-img').value = 'false';

        const imagensProdutoEdit = window.getProdutoImagens(p);
        window.carregarImagensExistentesUpload('e-file', imagensProdutoEdit);
        if (imagensProdutoEdit.length) {
            document.getElementById('e-img-preview').src = imagensProdutoEdit[0];
            document.getElementById('e-img-preview').style.display = 'block';
            document.getElementById('btn-remove-e-img').style.display = 'inline-flex';
            document.getElementById('e-img-none').style.display = 'none';
        } else {
            document.getElementById('e-img-preview').src = '';
            document.getElementById('e-img-preview').style.display = 'none';
            document.getElementById('btn-remove-e-img').style.display = 'none';
            document.getElementById('e-img-none').style.display = 'block';
        }

        document.getElementById('e-cat').dispatchEvent(new Event('change'));
        window.openModal('modal-editar-prod');
    } catch (err) {
        console.error("Erro ao abrir edição do produto:", err);
        customAlert("Erro ao abrir edição do produto. Veja o Console para detalhes.", "Erro");
    }
};
window.openEditProd = window.openEditor;

document.getElementById('e-cat').addEventListener('change', function() {
    const catObj = globalCategories.find(c => c.nome === this.value);
    const showTam = catObj && (catObj.tipoColuna === 'Tamanho' || catObj.tipoColuna === 'Tamanho/Minimo');
    
    document.getElementById('e-tam-container').style.display = showTam ? 'block' : 'none';
    if(document.getElementById('e-tam')) {
        document.getElementById('e-tam').required = (catObj && catObj.tipoColuna === 'Tamanho');
    }
});

document.getElementById('form-edit-prod').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        const data = { nome: document.getElementById('e-nome').value, categoria: document.getElementById('e-cat').value, tamanho: document.getElementById('e-tam').value, preco: parseFloat(document.getElementById('e-preco').value)||0, min: parseInt(document.getElementById('e-min').value)||1, descricaoItem: document.getElementById('e-dmenu').value, descricaoResumo: document.getElementById('e-dres').value, descricaoPopup: document.getElementById('e-dpop').value };
        const urlsEditProduto = await window.uploadProdutoImagens('e-file');
        if (urlsEditProduto.length) {
            data.imagemUrl = urlsEditProduto[0] || "";
            data.imagensUrls = urlsEditProduto;
        } else if (document.getElementById('e-remove-img').value === 'true') {
            data.imagemUrl = "";
            data.imagensUrls = [];
        } 
        await updateDoc(doc(db, "produtos", document.getElementById('e-id').value), data); customAlert("Produto Atualizado!"); window.limparListaImagensUpload?.('e-file');
        window.closeModal('modal-editar-prod', 'form-edit-prod'); loadProds(); 
    } catch(err) { console.error('Erro ao salvar produto:', err); customAlert('Erro ao salvar produto. Veja o Console para detalhes.', 'Erro'); } finally { btn.innerHTML = 'Salvar Alterações'; btn.disabled = false; }
};

window.togP = async(id, s) => { 
    await updateDoc(doc(db, "produtos", id), {ativo:s}); 
    const index = allProducts.findIndex(p => p.id === id);
    if(index > -1) allProducts[index].ativo = s;
    window.renderProdsTable(); 
};

window.delP = async(id) => { 
    customConfirm("Excluir item?", async () => { 
        await deleteDoc(doc(db, "produtos", id)); 
        allProducts = allProducts.filter(p => p.id !== id);
        window.renderProdsTable(); 
        window.renderOrcamentoMenu();
    }); 
};

document.getElementById('search-aviso').addEventListener('input', () => { window.renderAvisosTable(); });
window.limparFiltroComunicados = function() {
    const campo = document.getElementById('search-aviso');
    if (campo) campo.value = '';
    window.renderAvisosTable();
};
document.getElementById('form-add-aviso').onsubmit = async(e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    btn.disabled = true;
    try {
        let url = "";
        const f = document.getElementById('aa-file').files[0];
        if(f) url = await upImg(f);
        const ordem = Date.now();
        await addDoc(collection(db, "avisos"), {
            titulo: (document.getElementById('aa-tit').value || '').trim(),
            texto: window.getAvisoRichText('aa'),
            ...getAvisoScheduleFromForm('aa'),
            imagemUrl: url,
            posicaoImagem: document.getElementById('aa-img-pos').value || 'top',
            ativo: true,
            ordem
        });
        customAlert("Comunicado criado!");
        window.limparListaImagensUpload?.('aa-file');
        window.closeModal('modal-add-aviso', 'form-add-aviso');
        window.setAvisoRichText('aa', '');
        window.setAvisoImagePosition('aa', 'top');
        loadAvisos();
    } catch(err) {
        console.error(err);
        customAlert("Erro ao criar comunicado.", "Erro");
    } finally {
        btn.innerHTML = 'Criar Comunicado';
        btn.disabled = false;
    }
};

async function loadAvisos() {
    const s = await getDocs(collection(db, "avisos"));
    allAvisos = [];
    s.forEach(d => allAvisos.push({id: d.id, ...d.data()}));
    window.renderAvisosTable();
}

window.renderAvisosTable = function() {
    const tb = document.querySelector("#tbl-avisos tbody");
    tb.innerHTML = "";
    const searchTerm = document.getElementById('search-aviso').value.toLowerCase();
    const lista = orderedAvisosList()
        .filter(a => getAvisoStatus(a).grupo === currentAvisosTab)
        .filter(a => `${a.titulo || ''} ${stripCatNotice(a.texto || '')}`.toLowerCase().includes(searchTerm));

    if (lista.length === 0) {
        tb.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 45px 20px; color:#999; font-family: var(--font-numbers);">Nenhum comunicado encontrado.</td></tr>`;
        return;
    }

    lista.forEach(a => {
        const isAtivo = a.ativo !== false;
        const status = getAvisoStatus(a);
        const textoHtml = sanitizeRichText(a.texto || '');
        const textoPlain = stripCatNotice(a.texto || '') || '-';
        const imgPos = a.posicaoImagem || 'top';
        const avisoImgs = window.getAvisoImagens(a);
        const imgHtml = avisoImgs.length ? renderClickableAvisoImage(avisoImgs[0], 'img-preview') : '-';

        tb.innerHTML += `<tr class="aviso-row" data-aviso-id="${a.id}">
            <td class="aviso-select-cell" data-label="Selecionar:" style="text-align:center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${a.id}" onchange="window.checkSelection('avisos')"></td>
            <td class="aviso-image-cell" data-label="Imagem:">${imgHtml}</td>
            <td class="aviso-title-cell" data-label="Título:"><strong>${escapeHTML(a.titulo || '-')}</strong></td>
            <td class="aviso-message-cell" data-label="Mensagem:"><small class="aviso-message-summary" title="${escapeHTML(textoPlain)}">${textoHtml || '-'}</small></td>
            <td class="aviso-mobile-preview-cell" data-label="">${buildAvisoMobilePreview(a)}</td>
            <td class="aviso-period-cell desktop-schedule-cell" data-label="Programação:">${renderAvisoScheduleHtml(a)}</td>
            <td class="aviso-mobile-start mobile-schedule-cell" data-label="Início:">${getAvisoScheduleValue(a.inicio)}</td>
            <td class="aviso-mobile-end mobile-schedule-cell" data-label="Fim:">${getAvisoScheduleValue(a.fim)}</td>
            <td class="aviso-status-cell" data-label="Status:"><span class="badge ${status.stClass}">${status.st}</span></td>
            <td class="aviso-actions-cell" data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditAviso('${a.id}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action copy" title="Copiar comunicado" onclick="window.copyAviso('${a.id}')"><i class="fas fa-copy"></i></button>
                    <button class="btn-action toggle ${isAtivo ? 'cat-toggle-visible' : 'cat-toggle-hidden'}" onclick="window.togA('${a.id}', ${!isAtivo})"><i class="fas fa-${isAtivo?'eye':'eye-slash'}"></i></button>
                    <button class="btn-action del" onclick="window.delDoc('avisos','${a.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

window.openEditAviso = async(id) => {
    const a = (await getDoc(doc(db,"avisos",id))).data();
    document.getElementById('ea-id').value = id;
    document.getElementById('ea-tit').value = a.titulo || '';
    window.setAvisoRichText('ea', a.texto || '');
    window.setAvisoImagePosition('ea', a.posicaoImagem || 'top');
    setAvisoScheduleFields('ea', a.inicio, a.fim);
    const avisoImgsEdit = window.getAvisoImagens(a);
    window.carregarImagensExistentesUpload('ea-file', avisoImgsEdit);
    if (avisoImgsEdit.length) {
        document.getElementById('ea-img-preview').src = avisoImgsEdit[0];
        document.getElementById('ea-img-preview').style.display = 'block';
        document.getElementById('btn-remove-ea-img').style.display = 'inline-block';
        document.getElementById('ea-img-none').style.display = 'none';
    } else {
        document.getElementById('ea-img-preview').style.display = 'none';
        document.getElementById('btn-remove-ea-img').style.display = 'none';
        document.getElementById('ea-img-none').style.display = 'block';
    }
    document.getElementById('ea-remove-img').value = 'false';
    window.openModal('modal-editar-aviso');
};

document.getElementById('form-edit-aviso').onsubmit = async(e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    btn.disabled = true;
    try {
        let data = {
            titulo: (document.getElementById('ea-tit').value || '').trim(),
            texto: window.getAvisoRichText('ea'),
            ...getAvisoScheduleFromForm('ea'),
            posicaoImagem: document.getElementById('ea-img-pos').value || 'top'
        };
        const avisoUrlsEdit = await window.uploadProdutoImagens('ea-file');
        if (avisoUrlsEdit.length) {
            data.imagemUrl = avisoUrlsEdit[0] || "";
            data.imagensUrls = avisoUrlsEdit;
        } else if (document.getElementById('ea-remove-img').value === 'true') {
            data.imagemUrl = "";
            data.imagensUrls = [];
        }
        await updateDoc(doc(db, "avisos", document.getElementById('ea-id').value), data);
        customAlert("Comunicado atualizado!");
        window.limparListaImagensUpload?.('ea-file');
        window.closeModal('modal-editar-aviso', 'form-edit-aviso');
        loadAvisos();
    } catch(e) {
        console.error(e);
        customAlert("Erro ao salvar comunicado.", "Erro");
    } finally {
        btn.innerHTML = 'Salvar Alterações';
        btn.disabled = false;
    }
};

window.copyAviso = async function(id) {
    try {
        const ordered = orderedAvisosList();
        const index = ordered.findIndex(a => a.id === id);
        const source = ordered[index] || allAvisos.find(a => a.id === id);
        if (!source) return;

        const copyData = { ...source };
        delete copyData.id;
        copyData.titulo = `${source.titulo || 'Comunicado'} (Cópia)`;
        copyData.createdAt = Date.now();
        copyData.updatedAt = Date.now();

        const newRef = await addDoc(collection(db, "avisos"), copyData);
        const ids = ordered.map(a => a.id);
        ids.splice(index + 1, 0, newRef.id);
        await Promise.all(ids.map((avisoId, pos) => updateDoc(doc(db, "avisos", avisoId), { ordem: pos })));
        customAlert("Comunicado copiado!");
        loadAvisos();
    } catch(err) {
        console.error('Erro ao copiar comunicado:', err);
        customAlert('Não foi possível copiar o comunicado.', 'Atenção');
    }
};

window.togA = async(id, s) => {
    await updateDoc(doc(db, "avisos", id), {ativo: s});
    loadAvisos();
};

let currentOrcCatFilter = '';
let orcQtdState = {};
window.orcCupomAplicado = null;

window.getOrcQtd = function(id) { return orcQtdState[id] || 0; };
window.inputQtdOrcamento = function(input, itemId) { let val = parseInt(input.value); if(isNaN(val) || val < 0) val = 0; orcQtdState[itemId] = val; window.calcOrcamentoTotal(); };

function formatarTamanhoOrcamento(valor) {
    let texto = window.formatText((valor || '-').toString().trim());
    if (texto.includes(' (')) {
        texto = texto.replace(/\s+\(([^)]+)\)/, function(_, peso) {
            return ` <span class="peso-mobile">(${peso.toLowerCase()})</span>`;
        });
    }
    return texto;
}

window.limparFiltroOrcamento = function() {
    const campo = document.getElementById('search-orcamento');
    if (campo) campo.value = '';
    window.renderOrcamentoMenu();
};

window.renderOrcamentoMenu = function() {
    const container = document.getElementById('orc-menu-container'); 
    const nav = document.getElementById('orc-cats-nav');
    container.innerHTML = ""; nav.innerHTML = "";
    
    // No orçamento do Admin, as categorias ficam disponíveis mesmo se estiverem ocultas/agendadas para o site de clientes.
    const termoBuscaOrcamento = (document.getElementById('search-orcamento')?.value || '').trim().toLowerCase();
    const normalizarBuscaOrcamento = (valor) => (valor || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const termoNormalizado = normalizarBuscaOrcamento(termoBuscaOrcamento);
    
    const orcAgrupados = {}; 
    allProducts
        .filter(p => p.ativo)
        .filter(p => {
            if (!termoNormalizado) return true;
            return [p.nome, p.categoria, p.tamanho, p.descricaoItem, p.descricaoResumo, p.descricaoPopup]
                .some(valor => normalizarBuscaOrcamento(valor).includes(termoNormalizado));
        })
        .forEach(p => { 
            const cat = p.categoria || 'Geral'; 
            if(!orcAgrupados[cat]) orcAgrupados[cat] = []; 
            orcAgrupados[cat].push(p); 
        });
    
    const categoriasOrdenadas = Object.keys(orcAgrupados).sort(window.sortAlfabetico);
    if(categoriasOrdenadas.length > 0 && (!currentOrcCatFilter || !categoriasOrdenadas.includes(currentOrcCatFilter))) currentOrcCatFilter = categoriasOrdenadas[0];
    
    categoriasOrdenadas.forEach(c => {
        const idGrupo = `orc-grupo-${c.toLowerCase().replace(/\s/g, '-')}`;
        nav.innerHTML += `<a href="#${idGrupo}" class="categoria-btn-orc ${currentOrcCatFilter === c ? 'active-link' : ''}" data-target="${idGrupo}" onclick="event.preventDefault(); window.filterOrc('${c}')">${c}</a>`;
    });

    // Construtor inteligente de tabelas para manter o visual limpo
    const gerarTabelaHtml = (listaItens, tipoColuna) => {
        if(listaItens.length === 0) return '';
        
        let labelDesktop = tipoColuna === 'Mínimo' ? 'Mínimo' : 'Tamanho';
        let labelMobile = tipoColuna === 'Mínimo' ? 'MÍN.' : 'TAM.';
        
        let thSecundaria = (tipoColuna && tipoColuna !== 'Nenhuma') ? `<th class="col-sec"><span class="th-mobile">${labelMobile}</span><span class="th-desktop">${labelDesktop}</span></th>` : '';
        let t = `<div class="table-card-orc table-card" style="margin-bottom: 20px;"><table class="orc-table"><caption>${tipoColuna || 'Itens'}</caption><thead><tr><th class="col-item">ITEM</th><th class="col-icon"></th>${thSecundaria}<th class="col-unid"><span class="th-mobile">UNID.</span><span class="th-desktop">Unidade</span></th><th class="col-qtd"><span class="th-mobile">QTD</span><span class="th-desktop">Quantidade</span></th></tr></thead><tbody>`;

        let chaveAtual = null; 
        const agruparPorNome = (tipoColuna === 'Tamanho'); 
        const contagemNomes = {};
        if(agruparPorNome) listaItens.forEach(i => { const chave = `${(i.nome || 'Sem Nome').trim().toLowerCase()}|||${(i.descricaoItem || '').trim().toLowerCase()}`; contagemNomes[chave] = (contagemNomes[chave] || 0) + 1; });

        listaItens.forEach((p, index) => {
            const inputHtml = `<div class="quantidade-input-group"><button type="button" class="qtd-btn-table" onclick="window.alterarQtdOrcamento('${p.id}', -1)">-</button><input type="number" value="${window.getOrcQtd(p.id)}" oninput="window.inputQtdOrcamento(this, '${p.id}')" class="quantidade-input orc-qtd-input" data-item-id="${p.id}"><button type="button" class="qtd-btn-table" onclick="window.alterarQtdOrcamento('${p.id}', 1)">+</button></div>`;
            const iconeHint = p.imagemUrl ? `<i class="fas fa-camera foto-hint"></i>` : (p.descricaoPopup ? `<i class="fas fa-info-circle foto-hint"></i>` : '');
            const celulaNomeHTML = `<div class="item-nome-texto" style="line-height: 1.2;">${window.formatText((p.nome || 'Sem Nome').trim())}</div>${p.descricaoItem ? `<div class="descricao descricao-orc" style="text-align: left;">${window.formatText(p.descricaoItem)}</div>` : ''}`;
            
            // Mantém a mesma apresentação do Cardápio: tamanho em duas linhas quando houver peso, ex.: P / (1 kg).
            let conteudoSecundario = tipoColuna === 'Mínimo' ? (p.min || 1) : formatarTamanhoOrcamento(p.tamanho || '-');
            let tdSec = (tipoColuna && tipoColuna !== 'Nenhuma') ? `<td class="col-sec">${conteudoSecundario}</td>` : '';
            
            const precoNumero = Number(p.preco) || 0;
            const celulasRestantes = `${tdSec}<td class="col-unid"><span class="moeda">R$</span> <span class="valor">${precoNumero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></td><td class="col-qtd"><div class="quantidade-container">${inputHtml}</div></td>`;
            
            if(agruparPorNome) {
                const chaveAgrupamento = `${(p.nome || 'Sem Nome').trim().toLowerCase()}|||${(p.descricaoItem || '').trim().toLowerCase()}`;
                const proximoItem = listaItens[index + 1];
                const proximaChave = proximoItem ? `${(proximoItem.nome || 'Sem Nome').trim().toLowerCase()}|||${(proximoItem.descricaoItem || '').trim().toLowerCase()}` : null;
                const classeSeparador = (!proximaChave || proximaChave !== chaveAgrupamento) ? ' class="group-separator"' : '';

                if(chaveAgrupamento !== chaveAtual) { 
                    chaveAtual = chaveAgrupamento; 
                    t += `<tr${classeSeparador}><td rowspan="${contagemNomes[chaveAtual]}" class="item-group-cell col-item">${celulaNomeHTML}</td><td rowspan="${contagemNomes[chaveAtual]}" class="item-group-cell col-icon">${iconeHint}</td>${celulasRestantes}</tr>`; 
                } else {
                    t += `<tr${classeSeparador}><td style="display:none;"></td><td style="display:none;"></td>${celulasRestantes}</tr>`;
                }
            } else { 
                t += `<tr class="group-separator"><td class="col-item">${celulaNomeHTML}</td><td class="col-icon">${iconeHint}</td>${celulasRestantes}</tr>`; 
            }
        });
        return t + `</tbody></table></div>`;
    };

    categoriasOrdenadas.filter(c=>c===currentOrcCatFilter).forEach(nomeCat => {
        const catObj = globalCategories.find(c => c.nome === nomeCat) || { tipoColuna: 'Tamanho' };
        const itens = orcAgrupados[nomeCat].sort(sortProducts);

        let htmlFull = `<div class="categoria-group-orc active-group" id="orc-grupo-${nomeCat.toLowerCase().replace(/\s/g, '-')}"><h2 class="categoria-title-orc">${nomeCat}</h2>`;
        
        // Se a categoria for Tamanho/Minimo, segrega e gera dois grupos
        if (catObj.tipoColuna === 'Tamanho/Minimo') {
            const itensTam = itens.filter(i => i.tamanho && i.tamanho.trim() !== '');
            const itensMin = itens.filter(i => !i.tamanho || i.tamanho.trim() === '');
            
            if(itensTam.length > 0) {
                htmlFull += gerarTabelaHtml(itensTam, 'Tamanho');
            }
            if(itensMin.length > 0) {
                htmlFull += gerarTabelaHtml(itensMin, 'Mínimo');
            }
        } else {
            // Se for apenas uma coisa ou outra, segue normal
            htmlFull += gerarTabelaHtml(itens, catObj.tipoColuna);
        }
        
        htmlFull += `</div>`; 
        container.innerHTML += htmlFull;
    });

    window.calcOrcamentoTotal(); 
    configurarEventosDragOrcamento();
};

window.filterOrc = function(cat) { currentOrcCatFilter = cat; window.renderOrcamentoMenu(); };
window.alterarQtdOrcamento = function(itemId, delta) { let val = (orcQtdState[itemId] || 0) + delta; if(val < 0) val = 0; orcQtdState[itemId] = val; const input = document.querySelector(`.orc-qtd-input[data-item-id="${itemId}"]`); if(input) input.value = val; window.calcOrcamentoTotal(); };
window.removerItemOrcamento = function(itemId) { orcQtdState[itemId] = 0; window.renderOrcamentoMenu(); window.calcOrcamentoTotal(); };

window.calcOrcamentoTotal = function() {
    let bruto = 0, totalItens = 0;
    const resumoItensPopup = document.getElementById("popup-resumo-itens-orc");
    if (resumoItensPopup) resumoItensPopup.innerHTML = '';

    const gruposResumo = {};
    allProducts.forEach(p => {
        const q = orcQtdState[p.id] || 0;
        const preco = converterValorParaNumero(p.preco);
        if (q > 0) {
            bruto += (q * preco);
            totalItens += q;
            const cat = p.categoria || 'Geral';
            if (!gruposResumo[cat]) gruposResumo[cat] = [];
            gruposResumo[cat].push({ q, p: preco, desc: p.descricaoResumo || p.nome, id: p.id });
        }
    });

    const descManual = Math.max(0, converterValorParaNumero(document.getElementById('orc-desconto')?.value || 0));
    const descCupom = window.orcCupomAplicado?.desconto || 0;
    const liq = Math.max(0, bruto - descCupom - descManual);

    if (document.getElementById('orc-bruto-txt')) document.getElementById('orc-bruto-txt').textContent = bruto.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    if (document.getElementById('orc-liquido-txt')) document.getElementById('orc-liquido-txt').textContent = liq.toLocaleString('pt-BR', {minimumFractionDigits: 2});

    const btnSummary = document.getElementById('fixed-summary-orc');
    if (bruto > 0) {
        if (btnSummary) {
            btnSummary.style.display = 'block';
            document.getElementById('summary-total-orc').textContent = `R$ ${liq.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
            document.getElementById('summary-item-count-orc').textContent = `/ ${totalItens} itens`;
        }
        if (resumoItensPopup) {
            for (const grupo in gruposResumo) {
                resumoItensPopup.innerHTML += `<div class="resumo-grupo-titulo">${grupo}:</div>`;
                gruposResumo[grupo].forEach(item => {
                    const descricaoItemPopupFormatada = window.formatText(item.desc);
                    resumoItensPopup.innerHTML += `<div class="resumo-item-line"><div class="resumo-item-name">${descricaoItemPopupFormatada} <small>R$ ${(item.q * item.p).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></div><div style="display: flex; flex-direction: column; align-items: center; gap: 4px;"><div style="display: flex; align-items: center; gap: 8px;"><div class="resumo-item-input-group"><button type="button" class="resumo-qtd-btn" onclick="window.alterarQtdOrcamento('${item.id}', -1)">-</button><input type="number" value="${item.q}" oninput="window.inputQtdOrcamento(this, '${item.id}')"><button type="button" class="resumo-qtd-btn" onclick="window.alterarQtdOrcamento('${item.id}', 1)">+</button></div><button type="button" class="btn-excluir" onclick="window.removerItemOrcamento('${item.id}')"><i class="fas fa-trash"></i></button></div></div></div>`;
                });
            }

            if (window.orcCupomAplicado?.codigo || descManual > 0) {
                resumoItensPopup.innerHTML += `<div class="resumo-grupo-titulo">Descontos:</div>`;
                if (window.orcCupomAplicado?.codigo) resumoItensPopup.innerHTML += `<div class="resumo-item-line"><div class="resumo-item-name">Cupom: ${window.orcCupomAplicado.codigo}</div></div>`;
                if ((descCupom + descManual) > 0) resumoItensPopup.innerHTML += `<div class="resumo-item-line"><div class="resumo-item-name">Desconto: -R$ ${formatarNumeroMoedaPedido(descCupom + descManual)}</div></div>`;
            }
        }
    } else {
        if (btnSummary) btnSummary.style.display = 'none';
        const modal = document.getElementById('modal-orcamento-pedido');
        if (modal) { modal.classList.remove('show'); setTimeout(() => { modal.style.display = 'none'; }, 300); }
    }
};

window.abrirModalOrcamento = function() { window.openModal('modal-orcamento-pedido'); };

window.resetarCupomOrcamento = function() {
    window.orcCupomAplicado = null;
    const status = document.getElementById('orc-cupom-status');
    if (status) { status.textContent = ''; status.className = 'edit-cupom-status'; }
    window.calcOrcamentoTotal();
};

window.validarCupomOrcamento = async function() {
    const input = document.getElementById('orc-cupom');
    const status = document.getElementById('orc-cupom-status');
    const codigo = (input?.value || '').trim().toUpperCase();

    let subtotal = 0;
    allProducts.forEach(p => {
        const q = orcQtdState[p.id] || 0;
        if (q > 0) subtotal += q * converterValorParaNumero(p.preco);
    });

    window.orcCupomAplicado = null;
    if (status) { status.textContent = ''; status.className = 'edit-cupom-status'; }

    try {
        const resultado = await validarCupomAdmin(codigo, subtotal);
        if (!resultado.ok) {
            if (status) { status.textContent = resultado.motivo; status.className = 'edit-cupom-status erro'; }
            window.calcOrcamentoTotal();
            return;
        }

        window.orcCupomAplicado = { codigo: resultado.codigo, desconto: resultado.desconto };
        if (input) input.value = resultado.codigo;
        if (status) { status.textContent = `Cupom aplicado: -R$ ${formatarNumeroMoedaPedido(resultado.desconto)}`; status.className = 'edit-cupom-status ok'; }
        window.calcOrcamentoTotal();
    } catch (err) {
        console.error(err);
        if (status) { status.textContent = 'Erro ao validar cupom.'; status.className = 'edit-cupom-status erro'; }
        window.calcOrcamentoTotal();
    }
};

window.avancarDadosCliente = function() { document.getElementById('modal-orcamento-pedido').classList.remove('show'); setTimeout(() => { document.getElementById('modal-orcamento-pedido').style.display = 'none'; window.openModal('modal-orcamento-cliente'); }, 300); };
window.voltarResumoOrcamento = function() { document.getElementById('modal-orcamento-cliente').classList.remove('show'); setTimeout(() => { document.getElementById('modal-orcamento-cliente').style.display = 'none'; window.openModal('modal-orcamento-pedido'); }, 300); };
window.buscarContato = async function() {
    const nomeInput = document.getElementById('orc-nome');
    const telInput = document.getElementById('orc-tel');

    const focarTelefone = () => {
        if (telInput) {
            telInput.focus();
            try { telInput.click(); } catch (e) {}
        }
        window.showToast("Preencha o número do cliente.");
    };

    if ('contacts' in navigator && 'ContactsManager' in window && navigator.contacts?.select) {
        try {
            const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
            if (contacts.length > 0) {
                if (contacts[0].name && nomeInput) nomeInput.value = contacts[0].name[0];
                if (contacts[0].tel && telInput) telInput.value = contacts[0].tel[0].replace(/\D/g, '');
                return;
            }
        } catch (err) {
            console.warn("Busca automática de contato indisponível/cancelada:", err);
        }
    }

    focarTelefone();
};

window.gerarOrcamentoWA = async function() {
    let temItens = false; const groups = {}; let bruto = 0;
    allProducts.forEach(p => {
        const q = orcQtdState[p.id] || 0;
        if (q > 0) {
            temItens = true;
            const cat = p.categoria || 'Geral';
            const preco = converterValorParaNumero(p.preco);
            bruto += (q * preco);
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push({ q, p: preco, desc: p.descricaoResumo || p.nome });
        }
    });

    if (!temItens) return customAlert("Adicione itens ao orçamento.");

    const nm = document.getElementById('orc-nome').value.trim().toUpperCase(),
        tel = document.getElementById('orc-tel').value.trim(),
        dt = document.getElementById('orc-data').value,
        hrInput = document.getElementById('orc-hora'),
        hr = normalizarHoraPedidoManual(hrInput?.value || ''),
        pag = normalizarFormaPagamentoPedido(document.getElementById('orc-pag').value),
        modalidadeCreditoOrcamento = getModalidadeCreditoPedido({ Forma_de_Pagamento: pag }),
        obs = document.getElementById('orc-obs').value.trim();

    if (hrInput && hr) hrInput.value = hr;
    if (!nm || !dt || !hr || !pag || !tel) return customAlert("Preencha todos os dados.");

    const descManual = Math.max(0, converterValorParaNumero(document.getElementById('orc-desconto')?.value || 0));
    const descCupom = window.orcCupomAplicado?.desconto || 0;
    const desc = descManual + descCupom;
    const liq = Math.max(0, bruto - desc);
    const cupomOrcamento = (window.orcCupomAplicado?.codigo || '').trim().toUpperCase();

    const formatarMoedaOrc = (valor) => Number(valor || 0).toFixed(2).replace('.', ',');
    const descontoLinha = desc > 0 ? `Desconto: -R$${formatarMoedaOrc(desc)}\n` : '';
    const cupomLinha = cupomOrcamento ? `Cupom: ${cupomOrcamento}\n` : '';

    let txt = `Segue o resumo do orçamento do seu pedido!\n\n*_- Resumo do pedido_:*\n\n`, resumoTextoFirestore = '';

    for (const cat in groups) {
        txt += `*${cat}:*\n`;
        resumoTextoFirestore += `- ${cat}:\n`;

        groups[cat].forEach(i => {
            const tot = i.p * i.q;
            txt += `${i.desc} - ${i.q} un. (R$ ${formatarMoedaOrc(i.p)} cada) = R$ ${formatarMoedaOrc(tot)}\n`;
            resumoTextoFirestore += `${i.q} un. - ${i.desc} (R$ ${formatarMoedaOrc(i.p)}) = R$ ${formatarMoedaOrc(tot)}\n`;
        });

        txt += `\n`;
    }

    txt += `Valor dos Itens: R$ ${formatarMoedaOrc(bruto)}\n`;
    if (cupomLinha || descontoLinha) {
        txt += `${cupomLinha}${descontoLinha}`;
    }

    const dateFormatted = `${dt.split('-')[2]}/${dt.split('-')[1]}/${dt.split('-')[0]}`;
    txt += `Valor Final: R$ ${formatarMoedaOrc(liq)}\n\n`;
    txt += `*- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*\n\n`;
    txt += `_*- Informações do pedido:*_\n\n*Nome*: ${nm}\n*Data*: ${dateFormatted}\n*Horário*: ${hr}\n*Forma de Pagamento*: ${formatarPagamentoPedidoTexto(pag, modalidadeCreditoOrcamento)}`;

    if (obs) txt += `\n*Observações*: ${obs}`;

    const cupomFirestore = [
        cupomOrcamento ? `Cupom: ${cupomOrcamento}` : '',
        desc > 0 ? `Desconto: -R$${formatarMoedaOrc(desc)}` : ''
    ].filter(Boolean).join(' | ');

    const orderId = 'ORC-' + Date.now().toString();
    const dadosPedido = {
        ID_do_Pedido: orderId,
        origem: 'orcamento',
        Status_do_Pedido: 'Pedidos Orçados',
        Nome_Cliente: nm,
        Numero: tel,
        Data_Entrega: dateFormatted,
        Horario_Entrega: hr,
        Total_Final: formatarMoedaOrc(liq),
        Forma_de_Pagamento: pag,
        Modalidade_Credito: modalidadeCreditoOrcamento,
        ...montarDadosTaxaPagamento({ Forma_de_Pagamento: pag, Modalidade_Credito: modalidadeCreditoOrcamento, Total_Final: formatarMoedaOrc(liq) }),
        Status_Pagamento: 'Pendente',
        Cupom: cupomFirestore,
        Observacoes: obs,
        Resumo_dos_Itens: resumoTextoFirestore.trim(),
        createdAt: Date.now()
    };

    let cleanTel = tel.replace(/\D/g, '');
    if (cleanTel.length >= 10 && !cleanTel.startsWith('55')) cleanTel = '55' + cleanTel;

    const whatsappUrl = `https://wa.me/${cleanTel}?text=${encodeURIComponent(txt)}`;

    const salvamentoPedido = setDoc(doc(db, "pedidos", orderId), dadosPedido)
        .then(async () => { if (cupomOrcamento) await registrarUsoCupom(cupomOrcamento); window.showToast("Orçamento salvo como Pedido!"); })
        .catch((e) => {
            console.error("Erro ao salvar orçamento:", e);
            window.showToast("Resumo aberto no WhatsApp, mas houve erro ao salvar o orçamento.", true);
        });

    const janelaWhatsApp = window.open(whatsappUrl, '_blank');
    if (!janelaWhatsApp) window.location.href = whatsappUrl;

    await salvamentoPedido;

    orcQtdState = {};
    document.getElementById('form-pedido-orc').reset();
    document.getElementById('orc-desconto').value = '0';
    const orcCupomInput = document.getElementById('orc-cupom'); if (orcCupomInput) orcCupomInput.value = '';
    window.orcCupomAplicado = null;
    const orcCupomStatus = document.getElementById('orc-cupom-status'); if (orcCupomStatus) { orcCupomStatus.textContent = ''; orcCupomStatus.className = 'edit-cupom-status'; }
    window.renderOrcamentoMenu();
    document.getElementById('modal-orcamento-cliente').classList.remove('show');
    setTimeout(() => { document.getElementById('modal-orcamento-cliente').style.display = 'none'; }, 300);
};

function configurarEventosDragOrcamento() {
    const nav = document.getElementById('orc-cats-nav'); if(!nav) return;
    let isDown = false, startX, scrollLeft;
    nav.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - nav.offsetLeft; scrollLeft = nav.scrollLeft; });
    nav.addEventListener('mouseleave', () => isDown = false); nav.addEventListener('mouseup', () => isDown = false);
    nav.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); nav.scrollLeft = scrollLeft - ((e.pageX - nav.offsetLeft - startX) * 2); });
}

async function loadTema() {
    const t = await getDoc(doc(db, "config", "tema"));
    if(t.exists()) { const d = t.data(); if(d.bg) document.getElementById('cor-bg').value = d.bg; if(d.card) document.getElementById('cor-card').value = d.card; if(d.txt) document.getElementById('cor-txt').value = d.txt; if(d.acc) document.getElementById('cor-acc').value = d.acc; }
}
document.getElementById('form-cores').onsubmit = async(e) => { e.preventDefault(); await setDoc(doc(db, "config", "tema"), { bg: document.getElementById('cor-bg').value, card: document.getElementById('cor-card').value, txt: document.getElementById('cor-txt').value, acc: document.getElementById('cor-acc').value }); customAlert("Identidade visual aplicada!"); };

document.getElementById('form-carrossel').onsubmit = async(e) => {
    e.preventDefault(); const btn = document.getElementById('btn-up-car'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; btn.disabled = true;
    try { let count = (await getDocs(collection(db, "carrossel"))).size; for(let f of document.getElementById('car-files').files) { let url = await upImg(f); if(url) { await addDoc(collection(db, "carrossel"), { url: url, order: count }); count++; } } customAlert("Carrossel Atualizado!"); loadCarrossel(); e.target.reset(); document.getElementById('car-file-name').textContent = 'Nenhum arquivo'; } catch(err) {} finally { btn.innerHTML = '<i class="fas fa-upload"></i> Adicionar ao Carrossel'; btn.disabled = false; }
};

let dragSrcEl = null;
window.handleDragStart = function(e) { dragSrcEl = this; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/html', this.innerHTML); this.classList.add('dragging'); };
window.handleDragOver = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false; };
window.handleDrop = async function(e) { e.preventDefault(); if (dragSrcEl != this) { this.parentNode.insertBefore(dragSrcEl, this); const items = document.querySelectorAll('.carrossel-item'); for (let i = 0; i < items.length; i++) await updateDoc(doc(db, 'carrossel', items[i].getAttribute('data-id')), { order: i }); } return false; };
window.handleDragEnd = function(e) { this.classList.remove('dragging'); }

async function loadCarrossel() {
    const s = await getDocs(collection(db, "carrossel")); const div = document.getElementById("galeria-preview"); div.innerHTML = "";
    let arr = []; s.forEach(d => arr.push({id: d.id, ...d.data()})); arr.sort((a,b) => (a.order || 0) - (b.order || 0));
    arr.forEach(d => { div.innerHTML += `<div class="carrossel-item" data-id="${d.id}" draggable="true" ondragstart="window.handleDragStart.call(this, event)" ondragover="window.handleDragOver.call(this, event)" ondrop="window.handleDrop.call(this, event)" ondragend="window.handleDragEnd.call(this, event)"><img src="${d.url}" style="width:120px; height:120px; object-fit:cover; border-radius:15px; border:2px solid var(--favu-rust);"><button type="button" style="position:absolute; top:-8px; right:-8px; background:#E60000; color:white; border:none; border-radius:50%; width:25px; height:25px; cursor:pointer;" onclick="window.delDoc('carrossel','${d.id}')"><i class="fas fa-times"></i></button></div>`; });
}

window.delDoc = async(col, id) => { customConfirm("Excluir definitivamente?", async () => { await deleteDoc(doc(db, col, id)); if(col==='avisos') loadAvisos(); if(col==='carrossel') loadCarrossel(); }); };

window.inicializarKanban = function() {
    const board = document.getElementById('kanban-board'); if(!board) return; board.innerHTML = '';
    const bulkSelect = document.getElementById('bulk-move-select'); if(bulkSelect) bulkSelect.innerHTML = '';
    window.STATUS_FLOW.forEach(status => {
        board.innerHTML += `<div class="kanban-column" data-status="${status}"><div class="column-header"><div style="display:flex; align-items:center; gap:10px;"><input type="checkbox" class="column-select-all-checkbox" onclick="window.toggleSelectColumn(this, '${status}')"><span class="column-title-text">${getStatusPedidoLabel(status)} (<span class="count-badge">0</span>)</span></div></div><div class="column-content" id="col-${limparString(status)}" ondrop="window.drop(event)" ondragover="window.allowDrop(event)"></div></div>`;
        if(bulkSelect) bulkSelect.innerHTML += `<option value="${status}">${getStatusPedidoLabel(status)}</option>`;
    });
};

function normalizarStatusPedidoFluxo(status) {
    const valor = String(status || '').trim();
    if (valor.toLowerCase() === 'aguardando retirada') return 'Retirada';
    return valor || 'Pedidos Orçados';
}

function getStatusPedidoLabel(status) {
    const labels = {
        'Pedidos Orçados': 'Orçados',
        'Pedido Recebido': 'Recebido',
        'Pedido Confirmado': 'Confirmado',
        'Aguardando Retirada': 'Retirada',
        'Retirada': 'Retirada',
        'Entregue': 'Entregue',
        'Cancelado': 'Cancelado'
    };
    return labels[status] || status;
}

function limparString(str) { return str.replace(/[^a-zA-Z0-9]/g, ''); }

function criarDataLocal(a, m, d) {
    const ano = Number(a);
    const mes = Number(m);
    const dia = Number(d);
    if (!ano || !mes || !dia) return null;

    const data = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    if (
        data.getFullYear() !== ano ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
    ) {
        return null;
    }

    return data;
}

function parseDataBR(s) {
    if (!s) return null;

    if (s instanceof Date && !isNaN(s.getTime())) {
        return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0);
    }

    if (typeof s === 'object') {
        if (typeof s.toDate === 'function') return parseDataBR(s.toDate());
        if (s.seconds) return parseDataBR(new Date(s.seconds * 1000));
    }

    const texto = String(s).trim();
    let m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
        let ano = Number(m[3]);
        if (ano < 100) ano += 2000;
        return criarDataLocal(ano, Number(m[2]), Number(m[1]));
    }

    m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return criarDataLocal(Number(m[1]), Number(m[2]), Number(m[3]));

    return null;
}

function parseDataISO(s) {
    if (!s) return null;

    const texto = String(s).trim();
    let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return criarDataLocal(Number(m[1]), Number(m[2]), Number(m[3]));

    return parseDataBR(s);
}

function normalizarTextoBuscaPedido(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function normalizarNumeroBuscaPedido(valor) {
    return String(valor || '').replace(/\D/g, '');
}

function telefoneCombinaBuscaPedido(telefonePedido, buscaDigitada) {
    const numeroPedido = normalizarNumeroBuscaPedido(telefonePedido);
    const numeroBusca = normalizarNumeroBuscaPedido(buscaDigitada);

    if (!numeroBusca) return false;
    if (!numeroPedido) return false;

    return numeroPedido.includes(numeroBusca) || numeroBusca.includes(numeroPedido);
}

function nomeCombinaBuscaPedido(nomePedido, buscaDigitada) {
    const nome = normalizarTextoBuscaPedido(nomePedido);
    const busca = normalizarTextoBuscaPedido(buscaDigitada);

    if (!busca) return false;
    if (!nome) return false;

    return nome.includes(busca) || busca.includes(nome);
}

function pedidoCombinaBuscaLivre(p, buscaDigitada) {
    const busca = String(buscaDigitada || '').trim();
    if (!busca) return true;

    const buscaTexto = normalizarTextoBuscaPedido(busca);
    const buscaNumero = normalizarNumeroBuscaPedido(busca);

    if (nomeCombinaBuscaPedido(p.Nome_Cliente || '', busca)) return true;
    if (telefoneCombinaBuscaPedido(p.Numero || '', busca)) return true;

    const idPedido = normalizarTextoBuscaPedido(p.ID_do_Pedido || '');
    if (idPedido && idPedido.includes(buscaTexto)) return true;

    if (buscaNumero && normalizarNumeroBuscaPedido(p.ID_do_Pedido || '').includes(buscaNumero)) return true;

    return false;
}

function formatarDataDisplayPedido(data) {
    if (!data) return '';
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}

function formatarDataISOFiltroPedido(data) {
    if (!data) return '';
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function parseFiltroDataDigitadoPedido(valor) {
    const texto = String(valor || '').trim();
    if (!texto) return null;

    const partes = texto
        .split(/\s*(?:-|–|—|a|até|ate|,)\s*/i)
        .map(p => p.trim())
        .filter(Boolean);

    if (partes.length >= 2) {
        const inicio = parseDataBR(partes[0]) || parseDataISO(partes[0]);
        const fim = parseDataBR(partes[1]) || parseDataISO(partes[1]);
        if (inicio && fim) {
            if (fim < inicio) return { inicio: fim, fim: inicio };
            return { inicio, fim };
        }
    }

    const unica = parseDataBR(texto) || parseDataISO(texto);
    if (unica) return { inicio: unica, fim: null };

    return null;
}

function sincronizarFiltroDataOcultoPeloDisplay(valor, normalizarDisplay = false) {
    const campoOculto = document.getElementById('date-input');
    const campoDisplay = document.getElementById('date-filter-display');
    if (!campoOculto) return;

    const texto = String(valor || '').trim();
    if (!texto) {
        campoOculto.value = '';
        window.dataInicialIntervalo = null;
        window.dataFinalIntervalo = null;
        return;
    }

    const intervalo = parseFiltroDataDigitadoPedido(texto);
    if (!intervalo) return;

    window.dataInicialIntervalo = intervalo.inicio;
    window.dataFinalIntervalo = intervalo.fim;

    if (intervalo.inicio && intervalo.fim) {
        campoOculto.value = `${formatarDataISOFiltroPedido(intervalo.inicio)},${formatarDataISOFiltroPedido(intervalo.fim)}`;
        if (normalizarDisplay && campoDisplay) campoDisplay.value = `${formatarDataDisplayPedido(intervalo.inicio)} - ${formatarDataDisplayPedido(intervalo.fim)}`;
    } else if (intervalo.inicio) {
        campoOculto.value = formatarDataISOFiltroPedido(intervalo.inicio);
        if (normalizarDisplay && campoDisplay) campoDisplay.value = formatarDataDisplayPedido(intervalo.inicio);
    }
}

window.aplicarFiltroDataDigitada = function(valor, normalizarDisplay = false) {
    sincronizarFiltroDataOcultoPeloDisplay(valor, normalizarDisplay);
    window.filtrarPedidos?.();
};


function formatarDataParaInputPedido(valor) {
    const data = parseDataBR(valor);
    if (!data) return '';
    return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
}

function formatarDataInputParaBR(valor) {
    const data = parseDataISO(valor);
    if (!data) return '';
    return `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}/${data.getFullYear()}`;
}

function garantirValorSelectPedido(select, valor) {
    if (!select) return;
    const value = (valor || '').trim();

    if (!value) {
        select.value = '';
        return;
    }

    const existe = Array.from(select.options).some(option => option.value === value);
    if (!existe) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.insertBefore(option, select.firstChild);
    }

    select.value = value;
}

function normalizarHoraPedidoManual(valor) {
    if (!valor) return '';

    const texto = String(valor).trim();
    let hora = null;
    let minuto = null;

    const comSeparador = texto.match(/^(\d{1,2})\D+(\d{1,2})$/);
    if (comSeparador) {
        hora = Number(comSeparador[1]);
        minuto = Number(comSeparador[2]);
    } else {
        const numeros = texto.replace(/\D/g, '').slice(0, 4);
        if (!numeros) return '';

        if (numeros.length <= 2) {
            hora = Number(numeros);
            minuto = 0;
        } else if (numeros.length === 3) {
            // Ex.: 930 => 09:30
            hora = Number(numeros.slice(0, 1));
            minuto = Number(numeros.slice(1));
        } else {
            hora = Number(numeros.slice(0, 2));
            minuto = Number(numeros.slice(2));
        }
    }

    if (!Number.isInteger(hora) || !Number.isInteger(minuto)) return '';
    if (hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return '';

    return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
}

window.formatarCampoHoraPedido = function(input) {
    if (!input) return;

    const numeros = String(input.value || '').replace(/\D/g, '').slice(0, 4);

    if (numeros.length === 3 && Number(numeros.slice(0, 2)) > 23) {
        input.value = `${numeros.slice(0, 1)}:${numeros.slice(1)}`;
    } else if (numeros.length === 4) {
        input.value = `${numeros.slice(0, 2)}:${numeros.slice(2)}`;
    } else {
        input.value = numeros;
    }
};

window.normalizarCampoHoraPedido = function(input) {
    if (!input) return;
    const horaFormatada = normalizarHoraPedidoManual(input.value);
    if (horaFormatada) input.value = horaFormatada;
};

function parseHorario(s) { if (!s || typeof s !== 'string') return 0; const p = s.trim().split(':'); if (p.length !== 2) return 0; const h = parseInt(p[0], 10), m = parseInt(p[1], 10); if (isNaN(h) || isNaN(m)) return 0; return h * 60 + m; }
function ordenarPedidosPorDataHorario(pedidos) { return pedidos.sort((a, b) => { const dA = parseDataBR(a.Data_Entrega), dB = parseDataBR(b.Data_Entrega); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; const diff = dA.getTime() - dB.getTime(); if (diff !== 0) return diff; return parseHorario(a.Horario_Entrega) - parseHorario(b.Horario_Entrega); }); }
function converterValorParaNumero(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return isNaN(v) ? 0 : v;

    let s = String(v)
        .replace(/R\$/gi, '')
        .replace(/\s/g, '')
        .replace(/[^\d,.-]/g, '');

    if (!s || s === '-' || s === ',' || s === '.') return 0;

    const temVirgula = s.includes(',');
    const temPonto = s.includes('.');

    if (temVirgula && temPonto) {
        const ultimaVirgula = s.lastIndexOf(',');
        const ultimoPonto = s.lastIndexOf('.');

        if (ultimaVirgula > ultimoPonto) {
            // Formato BR: 1.234,56
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            // Formato US: 1,234.56
            s = s.replace(/,/g, '');
        }
    } else if (temVirgula) {
        const partes = s.split(',');
        const decimais = partes[partes.length - 1] || '';

        if (decimais.length > 0 && decimais.length <= 2) {
            s = partes.slice(0, -1).join('').replace(/\./g, '') + '.' + decimais;
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (temPonto) {
        const partes = s.split('.');
        const decimais = partes[partes.length - 1] || '';

        if (partes.length === 2 && decimais.length > 0 && decimais.length <= 2) {
            // Decimal com ponto: 1.30
            s = partes[0] + '.' + decimais;
        } else {
            // Milhar com ponto: 1.300 ou 1.300.000
            s = s.replace(/\./g, '');
        }
    }

    const n = Number(s);
    return isNaN(n) ? 0 : n;
}
function formatarValorComCentavos(v) { return converterValorParaNumero(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatarNumeroMoedaPedido(v) {
    const n = Number(v);
    return (isNaN(n) ? 0 : n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getDataValidadeCupom(dadosCupom) {
    if (!dadosCupom) return null;
    const raw = dadosCupom.dataValidade;
    if (!raw) return null;
    const data = raw?.toDate ? raw.toDate() : new Date(raw);
    if (isNaN(data.getTime())) return null;
    data.setHours(23, 59, 59, 999);
    return data;
}

function isCupomVencido(dadosCupom) {
    const validade = getDataValidadeCupom(dadosCupom);
    return validade ? new Date() > validade : false;
}

function getCupomMaxUsos(dadosCupom) {
    return Number(dadosCupom?.quantidadeDisponivel ?? dadosCupom?.maxUsos ?? 0) || 0;
}

function contarPedidosComCupom(codigo) {
    const cupomCodigo = String(codigo || '').trim().toUpperCase();
    if (!cupomCodigo || !Array.isArray(window.todosPedidos)) return 0;

    return window.todosPedidos.filter(p => {
        if (isPedidoExcluidoPainel(p)) return false;
        return extrairCodigoCupomPedido(p.Cupom || '') === cupomCodigo;
    }).length;
}

function getCupomUsosAtuais(dadosCupom) {
    const usosSalvos = Number(dadosCupom?.usosAtuais ?? dadosCupom?.usos ?? 0) || 0;
    const codigo = String(dadosCupom?.codigo || dadosCupom?.id || '').trim().toUpperCase();
    const usosEmPedidos = contarPedidosComCupom(codigo);
    return Math.max(usosSalvos, usosEmPedidos);
}

function isCupomEsgotado(dadosCupom) {
    const max = getCupomMaxUsos(dadosCupom);
    const usos = getCupomUsosAtuais(dadosCupom);
    return max > 0 && usos >= max;
}

function calcularDescontoCupom(dadosCupom, subtotal) {
    const valor = converterValorParaNumero(dadosCupom?.valor || 0);
    let desconto = 0;
    if (dadosCupom?.tipo === 'percentual') desconto = subtotal * (valor / 100);
    else desconto = valor;
    return Math.min(Math.max(0, desconto), subtotal);
}

async function validarCupomAdmin(codigo, subtotal) {
    const cupomCodigo = String(codigo || '').trim().toUpperCase();
    if (!cupomCodigo) return { ok: false, motivo: 'Informe um cupom.' };

    const cupomSnap = await getDoc(doc(db, "cupons", cupomCodigo));
    if (!cupomSnap.exists()) return { ok: false, motivo: 'Cupom não encontrado.' };

    const dadosCupom = { codigo: cupomCodigo, ...cupomSnap.data() };

    const statusOperacional = getStatusOperacionalCupom(dadosCupom);
    if (statusOperacional === 'inativo') return { ok: false, motivo: 'Cupom inativo.' };
    if (isCupomVencido(dadosCupom)) return { ok: false, motivo: 'Cupom expirado.' };
    if (isCupomEsgotado(dadosCupom)) return { ok: false, motivo: 'Cupom esgotado.' };

    const minimo = converterValorParaNumero(dadosCupom.valorMinimo || 0);
    if (subtotal < minimo) return { ok: false, motivo: `Mínimo de R$ ${formatarNumeroMoedaPedido(minimo)} para usar.` };

    const desconto = calcularDescontoCupom(dadosCupom, subtotal);
    if (desconto <= 0) return { ok: false, motivo: 'Cupom sem desconto válido.' };

    return { ok: true, codigo: cupomCodigo, dados: dadosCupom, desconto };
}

async function ajustarUsoCupom(codigo, delta) {
    const cupomCodigo = String(codigo || '').trim().toUpperCase();
    const ajuste = Number(delta) || 0;
    if (!cupomCodigo || ajuste === 0) return;

    try {
        const refCupom = doc(db, "cupons", cupomCodigo);
        const snapCupom = await getDoc(refCupom);
        if (!snapCupom.exists()) return;

        const dados = snapCupom.data();
        const usosSalvos = Number(dados.usosAtuais ?? dados.usos ?? 0) || 0;
        await updateDoc(refCupom, {
            usosAtuais: Math.max(0, usosSalvos + ajuste),
            updatedAt: Date.now()
        });
    } catch (err) {
        console.warn("Não foi possível ajustar uso do cupom:", err);
    }
}

async function registrarUsoCupom(codigo) {
    await ajustarUsoCupom(codigo, 1);
}

async function ajustarUsoCupomPedidoEditado(cupomAnterior, cupomAtual, novoPedido = false) {
    const anterior = String(cupomAnterior || '').trim().toUpperCase();
    const atual = String(cupomAtual || '').trim().toUpperCase();

    if (novoPedido) {
        if (atual) await ajustarUsoCupom(atual, 1);
        return;
    }

    if (anterior === atual) return;
    if (anterior) await ajustarUsoCupom(anterior, -1);
    if (atual) await ajustarUsoCupom(atual, 1);
}

function escapeHtmlPedido(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function extrairCodigoCupomPedido(...fontes) {
    for (const fonte of fontes) {
        const partes = String(fonte || '')
            .split(/\n|\|/g)
            .map(parte => parte.trim())
            .filter(Boolean);

        for (let parte of partes) {
            if (/^Desconto(?:\s+Manual)?\b/i.test(parte)) continue;

            let texto = parte
                .replace(/^Cupom\s*:?\s*/i, '')
                .replace(/\(-?\s*R?\$\s*[\d.,]+\)/gi, '')
                .replace(/:\s*-?\s*R?\$\s*[\d.,]+.*$/i, '')
                .replace(/-?\s*R?\$\s*[\d.,]+.*$/i, '')
                .replace(/\s*\([^)]*\)\s*$/g, '')
                .trim();

            if (!texto || /^(desconto|total|valor dos itens|bruto|liquido|líquido)$/i.test(texto)) continue;
            return texto.toUpperCase();
        }
    }

    return '';
}

function extrairDescontoManualPedido(...fontes) {
    let total = 0;

    fontes.forEach(fonte => {
        String(fonte || '')
            .split(/\n|\|/g)
            .map(parte => parte.trim())
            .filter(Boolean)
            .forEach(parte => {
                const ehLinhaDesconto = /^Desconto(?:\s+Manual)?\b/i.test(parte);
                const ehCupomLegadoComValor = /^Cupom\b/i.test(parte) && /R\$/i.test(parte);

                if (!ehLinhaDesconto && !ehCupomLegadoComValor) return;

                total += extrairValorDescontoLinhaPedido(parte);
            });
    });

    return total;
}

function limparDescontoManualPedido(valor) {
    return extrairCodigoCupomPedido(valor);
}

function montarCupomDescontoPedido(codigoCupom, descontoTotal) {
    const codigo = String(codigoCupom || '').trim().toUpperCase();
    const desconto = Math.max(0, Number(descontoTotal) || 0);
    const linhas = [];

    if (codigo) linhas.push(`Cupom: ${codigo}`);
    if (desconto > 0) linhas.push(`Desconto: -R$${formatarNumeroMoedaPedido(desconto)}`);

    return linhas.join('\n');
}

function formatarCupomDescontoPedido(valor) {
    const codigo = extrairCodigoCupomPedido(valor);
    const desconto = extrairDescontoManualPedido(valor);
    const linhas = [];

    if (codigo) {
        linhas.push(`<div class="card-cupom-line"><span class="card-cupom-label">Cupom:</span> ${escapeHtmlPedido(codigo)}</div>`);
    }

    if (desconto > 0) {
        linhas.push(`<div class="card-cupom-line"><span class="card-cupom-label">Desconto:</span> -R$${formatarNumeroMoedaPedido(desconto)}</div>`);
    }

    return linhas.join('');
}

function preencherDescontoManualEditPedido(valor) {
    const desconto = Math.max(0, Number(valor) || 0);
    const campo = document.getElementById('edit-desconto-pedido');
    const status = document.getElementById('edit-desconto-status');

    window.editDescontoManualAplicado = desconto;

    if (campo) campo.value = desconto > 0 ? formatarNumeroMoedaPedido(desconto).replace('.', '').replace(',', '.') : '0';

    if (status) {
        if (desconto > 0) {
            status.textContent = `Desconto aplicado: -R$ ${formatarNumeroMoedaPedido(desconto)}`;
            status.className = 'edit-cupom-status ok';
        } else {
            status.textContent = '';
            status.className = 'edit-cupom-status';
        }
    }
}
function normalizarStatusPagamentoPedido(valor) {
    const v = String(valor || '').trim().toLowerCase();
    if (!v || v === 'pagamento pendente' || v === 'pendente') return 'Pendente';
    if (v.includes('50')) return 'Pago 50%';
    if (v.includes('100') || v === 'pago') return 'Pago 100%';
    return valor || 'Pendente';
}
function gerarPedidoId(prefixo) {
    return `${prefixo}-${Date.now().toString()}`;
}
function extrairNumeroIdPedido(id) {
    return String(id || '').replace(/^(PED|ORC|PD|CPD|EXC|EXD)-?/i, '');
}
function getPedidoDocumentoId(id) {
    const pedido = window.todosPedidos.find(p => p.ID_do_Pedido === id || p._docId === id);
    return pedido?._docId || id;
}
function calcularNovoIdExcluido(id) {
    return `EXC-${extrairNumeroIdPedido(id)}`;
}
function isPedidoExcluidoPainel(p) {
    const id = String(p?.ID_do_Pedido || '');
    const status = String(p?.Status_do_Pedido || '').toLowerCase();
    return p?.excluido === true || /^EXC-|^EXD-/i.test(id) || status === 'excluído' || status === 'excluido';
}
function extrairValorDescontoLinhaPedido(linha) {
    const texto = String(linha || '').trim();
    if (!/(desconto|cupom)/i.test(texto)) return 0;

    let total = 0;

    // Prioriza apenas valores monetários explícitos com R$.
    const valoresMonetarios = texto.match(/-?\s*R\$\s*[\d.,]+/gi) || [];
    valoresMonetarios.forEach(valor => {
        const numero = Math.abs(converterValorParaNumero(valor));
        if (numero > 0) total += numero;
    });

    if (total > 0) return total;

    // Compatibilidade com algum registro antigo do tipo "Desconto: 27,00".
    // Não vale para linha de Cupom, para não capturar números no código do cupom.
    if (/^Desconto(?:\s+Manual)?\b/i.test(texto)) {
        const match = texto.match(/:\s*-?\s*([\d.,]+)/i) || texto.match(/Desconto(?:\s+Manual)?[^\d-]*-?\s*([\d.,]+)/i);
        if (match) {
            const numero = Math.abs(converterValorParaNumero(match[1]));
            if (numero > 0) return numero;
        }
    }

    return 0;
}

function extrairDescontosTotaisPedido(...fontes) {
    let total = 0;

    fontes.forEach(fonte => {
        String(fonte || '')
            .split(/\n|\|/g)
            .map(linha => linha.trim())
            .filter(Boolean)
            .forEach(linha => {
                total += extrairValorDescontoLinhaPedido(linha);
            });
    });

    return total;
}

function calcularValorPedidoPorItensCorrigidos(p) {
    if (!p || !p.Resumo_dos_Itens) return null;

    const itens = parseResumoEditPedido(p.Resumo_dos_Itens || '');
    if (!itens.length) return null;

    const subtotal = itens.reduce((acc, item) => {
        const qtd = parseInt(item.qtd) || 0;
        const preco = converterValorParaNumero(item.preco);
        return acc + (qtd * preco);
    }, 0);

    if (subtotal <= 0) return null;

    const descontoCupom = extrairDescontosTotaisPedido(p.Cupom || '');
    return Math.max(0, subtotal - descontoCupom);
}

function calcularValorPedido(p) {
    const valorCorrigidoPorItens = calcularValorPedidoPorItensCorrigidos(p);
    if (valorCorrigidoPorItens !== null) return valorCorrigidoPorItens;
    if (!p || !p.Total_Final) return 0;
    return converterValorParaNumero(p.Total_Final);
}

function normalizarFormaPagamentoPedido(valor) {
    const v = String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    if (v.includes('link')) return 'Crédito Link';
    if (v.includes('retirada')) return 'Crédito Retirada';
    if (v.includes('credito') || v.includes('cart')) return 'Crédito';
    if (v.includes('debito')) return 'Débito';
    if (v.includes('dinheiro')) return 'Dinheiro';
    if (v.includes('pix')) return 'Pix';
    if (v.includes('confirmar')) return 'A confirmar';
    return String(valor || '').trim();
}

function getModalidadeCreditoPedido(p) {
    const forma = normalizarFormaPagamentoPedido(p?.Forma_de_Pagamento || '');
    if (forma === 'Crédito Link') return 'Pagamento via Link';
    if (forma === 'Crédito Retirada') return 'Pagamento na retirada';
    return String(p?.Modalidade_Credito || p?.Modalidade_Pagamento || '').trim();
}

function formatarPagamentoPedidoTexto(forma, modalidadeCredito = '') {
    const formaNormalizada = normalizarFormaPagamentoPedido(forma);
    if (formaNormalizada === 'Crédito') {
        if (String(modalidadeCredito || '').toLowerCase().includes('link')) return 'Crédito Link';
        if (String(modalidadeCredito || '').toLowerCase().includes('retirada')) return 'Crédito Retirada';
    }
    return formaNormalizada || '';
}

function obterFormaPagamentoFiltroPedido(p) {
    const textoCompleto = `${p?.Forma_de_Pagamento || ''} ${p?.Modalidade_Credito || ''} ${p?.Modalidade_Pagamento || ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

    if (textoCompleto.includes('link')) return 'Crédito Link';
    if (textoCompleto.includes('retirada')) return 'Crédito Retirada';
    if (textoCompleto.includes('debito')) return 'Débito';

    const forma = normalizarFormaPagamentoPedido(p?.Forma_de_Pagamento || '');

    if (forma === 'Crédito') {
        return 'Crédito Link';
    }

    return forma;
}


function getTaxaPagamentoInfo(p) {
    const forma = normalizarFormaPagamentoPedido(p?.Forma_de_Pagamento || '');
    const modalidade = getModalidadeCreditoPedido(p).toLowerCase();

    if (forma === 'Débito') {
        return { percentual: 1.99, label: 'Taxa Débito' };
    }

    if (forma === 'Crédito Link' || (forma === 'Crédito' && modalidade.includes('link'))) {
        return { percentual: 4.98, label: 'Taxa Crédito' };
    }

    if (forma === 'Crédito Retirada' || (forma === 'Crédito' && modalidade.includes('retirada'))) {
        return { percentual: 3.09, label: 'Taxa Crédito' };
    }

    return { percentual: 0, label: '' };
}

function calcularTaxaPagamentoPedido(p) {
    const info = getTaxaPagamentoInfo(p);
    const total = calcularValorPedido(p);
    return Math.max(0, total * ((Number(info.percentual) || 0) / 100));
}

function calcularValorFaturamentoPedido(p) {
    return Math.max(0, calcularValorPedido(p) - calcularTaxaPagamentoPedido(p));
}

function montarDadosTaxaPagamento(p) {
    const info = getTaxaPagamentoInfo(p);
    const taxa = calcularTaxaPagamentoPedido(p);
    const recebido = calcularValorFaturamentoPedido(p);

    return {
        Taxa_Pagamento: info.label || '',
        Percentual_Taxa_Pagamento: info.percentual || 0,
        Valor_Taxa_Pagamento: taxa > 0 ? formatarNumeroMoedaPedido(taxa) : '',
        Valor_Recebido: taxa > 0 ? formatarNumeroMoedaPedido(recebido) : ''
    };
}

function formatarTaxaPagamentoHTML(p) {
    return '';
}

window.toggleCreditoPedidoAdmin = function() {
    // Mantido apenas por compatibilidade com versões antigas. Não há mais campo separado de tipo de crédito.
};


function listenPedidos() {
    onSnapshot(collection(db, "pedidos"), (snap) => {
        window.todosPedidos = []; snap.forEach(docSnap => { let d = docSnap.data(); if (!d.ID_do_Pedido) d.ID_do_Pedido = docSnap.id; d._docId = docSnap.id; window.todosPedidos.push(d); });
        window.filtrarPedidos();
        window.renderCupons?.();
    });
}

window.obterPedidosDaSemanaAtual = function() {
    let hoje = new Date(); hoje.setHours(0,0,0,0);
    let diaSemana = hoje.getDay(); // 0 é Domingo, 1 é Segunda...
    let diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); // Ajusta para Segunda-feira
    
    let segunda = new Date(hoje); segunda.setDate(diff);
    let domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6); // Soma 6 dias para o Domingo

    return window.todosPedidos.filter(p => {
        if (isPedidoExcluidoPainel(p)) return false;
        const d = parseDataBR(p.Data_Entrega);
        return d && d.getTime() >= segunda.getTime() && d.getTime() <= domingo.getTime();
    });
}

window.obterPedidosFiltrados = function() {
    const s = document.getElementById('search-input-pedidos') ? document.getElementById('search-input-pedidos').value.trim() : '';
    const displayData = document.getElementById('date-filter-display') ? document.getElementById('date-filter-display').value.trim() : '';
    
    // Sincroniza o filtro oculto sempre (mesmo se o usuário limpar o campo visualmente)
    sincronizarFiltroDataOcultoPeloDisplay(displayData, false);

    const df = document.getElementById('date-input') ? document.getElementById('date-input').value : '';
    const sp = document.getElementById('filter-status-pagamento') ? document.getElementById('filter-status-pagamento').value : '';
    const fp = document.getElementById('filter-forma-pagamento') ? document.getElementById('filter-forma-pagamento').value : '';
    const ob = document.getElementById('filter-observacao') ? document.getElementById('filter-observacao').value : '';

    return window.todosPedidos.filter(p => {
        if (isPedidoExcluidoPainel(p)) return false;
        if (s && !pedidoCombinaBuscaLivre(p, s)) return false;

        if (df) {
            const dp = parseDataBR(p.Data_Entrega);
            if (!dp) return false;

            if (df.includes(',')) {
                const [di, dF] = df.split(',');
                const dtI = parseDataISO(di.trim());
                const dtF = parseDataISO(dF.trim());
                if (!dtI || !dtF || !(dp.getTime() >= dtI.getTime() && dp.getTime() <= dtF.getTime())) return false;
            } else {
                const dt = parseDataISO(df.trim());
                if (!dt || dp.getTime() !== dt.getTime()) return false;
            }
        }

        if (sp && normalizarStatusPagamentoPedido(p.Status_Pagamento) !== normalizarStatusPagamentoPedido(sp)) return false;
        if (fp) {
            const formaFiltro = normalizarFormaPagamentoPedido(fp);
            const formaPedido = obterFormaPagamentoFiltroPedido(p);
            if (formaPedido !== formaFiltro) return false;
        }
        if (ob) { const tO = p.Observacoes && p.Observacoes.trim() !== ''; if (ob === 'com' && !tO) return false; if (ob === 'sem' && tO) return false; }
        return true;
    });
}

let timerFiltroPedidos;
window.filtrarPedidos = function() {
    // Cancela a busca anterior se o usuário ainda estiver digitando (Debounce)
    clearTimeout(timerFiltroPedidos);
    timerFiltroPedidos = setTimeout(() => {
        const displayData = document.getElementById('date-filter-display') ? document.getElementById('date-filter-display').value.trim() : '';
        sincronizarFiltroDataOcultoPeloDisplay(displayData, false);

        // O escopo sempre será idêntico ao que for retornado pelo filtro
        const escopo = window.obterPedidosFiltrados();
        window.renderizar(escopo);
    }, 350);
}

window.renderizar = function(pedidos) {
    pedidos = (pedidos || []).filter(p => !isPedidoExcluidoPainel(p));
    document.querySelectorAll('.column-content').forEach(el => el.innerHTML = '');
    const contadores = {}; window.STATUS_FLOW.forEach(s => contadores[s] = 0);
    const pedStatus = {}; window.STATUS_FLOW.forEach(s => pedStatus[s] = []);

    pedidos.forEach(p => { const statusAtual = normalizarStatusPedidoFluxo(p.Status_do_Pedido || 'Pedidos Orçados'); const s = window.STATUS_FLOW.find(x => x.toLowerCase() === statusAtual.toLowerCase()) || 'Pedidos Orçados'; pedStatus[s].push(p); });

    window.STATUS_FLOW.forEach(s => {
        const ord = ordenarPedidosPorDataHorario([...pedStatus[s]]);
        const col = document.getElementById(`col-${limparString(s)}`);
        if (col) {
            // Removido o "Empty State". Se não houver pedidos, o loop simplesmente não roda
            // e a coluna fica perfeitamente limpa e vazia!
            ord.forEach(p => { col.appendChild(window.criarCardHTML(p)); contadores[s]++; });
        }
    });

    window.STATUS_FLOW.forEach(s => { const c = document.querySelector(`.kanban-column[data-status="${s}"]`); if(c) c.querySelector('.count-badge').textContent = contadores[s]; });
    if (window.innerWidth <= 768) document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('expanded'));
    window.configurarAcordeaoColunas(); window.atualizarDashboardPedidos();
}

window.atualizarDashboardPedidos = function() {
    // Garante que o Faturamento some exatamentre a mesma lista do Kanban
    let pedCalc = window.ticketsSelecionados.size > 0 
        ? window.todosPedidos.filter(p => window.ticketsSelecionados.has(p.ID_do_Pedido)) 
        : window.obterPedidosFiltrados();
            
    let tv = 0, tp = 0;
    pedCalc.filter(p => !isPedidoExcluidoPainel(p)).forEach(p => { 
        if (!(p.Status_do_Pedido || '').toLowerCase().includes('cancelado')) {
            tp++; 
            tv += calcularValorFaturamentoPedido(p); 
        }
    });
    if(document.querySelector('#dashboard-totals strong')) document.querySelector('#dashboard-totals strong').textContent = tv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if(document.getElementById('total-count')) document.getElementById('total-count').textContent = `${tp} pedido${tp !== 1 ? 's' : ''}`;
}

window.criarCardHTML = function(p) {
    const c = document.createElement('div'); const st = normalizarStatusPedidoFluxo(p.Status_do_Pedido || '').replace(/\s+/g, '-'); const tO = p.Observacoes && p.Observacoes.trim() !== '';
    c.className = `pedido-card status-${st} ${tO ? 'com-observacao' : ''} ${window.ticketsSelecionados.has(p.ID_do_Pedido) ? 'selected' : ''}`;
    if(window.isDragEnabled) c.draggable = true; c.id = `card-${p.ID_do_Pedido}`; c.dataset.id = p.ID_do_Pedido;
    if(window.isDragEnabled) {
        c.addEventListener('dragstart', window.drag);
        c.addEventListener('dragend', window.dragEnd);
    }
    c.addEventListener('click', (e) => { if(e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') window.abrirModalEdicao(p.ID_do_Pedido); });

    const pgStatus = normalizarStatusPagamentoPedido(p.Status_Pagamento || 'Pendente');
    const pg = pgStatus.toLowerCase(); let pC = pg.includes('50%') ? 'pg-parcial' : (pg.includes('100%') || pg === 'pago' ? 'pg-pago' : 'pg-pendente');
    const totalExibicaoPedido = calcularValorPedido(p);
    const cupomDescontoHTML = formatarCupomDescontoPedido(p.Cupom || '');
    const formaPagamentoNormalizada = normalizarFormaPagamentoPedido(p.Forma_de_Pagamento || '');
    const modalidadeCredito = getModalidadeCreditoPedido(p);
    const taxaPagamentoHTML = formatarTaxaPagamentoHTML(p);
    let tt = '', tc = '';
    const taxaPagamentoValorTag = calcularTaxaPagamentoPedido(p);
    const taxaPagamentoTextoTag = taxaPagamentoValorTag > 0 ? `<span class="payment-tag-taxa">-R$: ${formatarNumeroMoedaPedido(taxaPagamentoValorTag)}</span>` : '';
    const montarTagPagamentoComTaxa = (nome) => taxaPagamentoTextoTag ? `<span class="payment-tag-nome">${nome}</span>${taxaPagamentoTextoTag}` : nome;

    if (formaPagamentoNormalizada === 'Crédito Link') { tt = montarTagPagamentoComTaxa('Crédito Link'); tc = 'credito-link'; }
    else if (formaPagamentoNormalizada === 'Crédito Retirada') { tt = montarTagPagamentoComTaxa('Crédito Retirada'); tc = 'credito-retirada'; }
    else if (formaPagamentoNormalizada === 'Crédito') {
        const modalidadeLower = modalidadeCredito.toLowerCase();
        if (modalidadeLower.includes('link')) { tt = montarTagPagamentoComTaxa('Crédito Link'); tc = 'credito-link'; }
        else if (modalidadeLower.includes('retirada')) { tt = montarTagPagamentoComTaxa('Crédito Retirada'); tc = 'credito-retirada'; }
        else { tt = montarTagPagamentoComTaxa('Crédito'); tc = 'credito'; }
    }
    else if (formaPagamentoNormalizada === 'Débito') { tt = montarTagPagamentoComTaxa('Débito'); tc = 'debito'; }
    else if (formaPagamentoNormalizada === 'Dinheiro') { tt = 'DINHEIRO'; tc = 'dinheiro'; }
    else if (formaPagamentoNormalizada === 'Pix') { tt = 'PIX'; tc = 'pix'; }
    else if (formaPagamentoNormalizada === 'A confirmar') { tt = 'A CONFIRMAR'; tc = 'a-confirmar'; }
    else if (formaPagamentoNormalizada) { tt = formaPagamentoNormalizada.toUpperCase(); tc = formaPagamentoNormalizada.toLowerCase().replace(/[^a-z0-9]/g, ''); }

    c.innerHTML = `<div class="card-header"><input type="checkbox" class="card-checkbox" ${window.ticketsSelecionados.has(p.ID_do_Pedido) ? 'checked' : ''} onclick="window.toggleSelecao('${p.ID_do_Pedido}', this); event.stopPropagation();"><div style="text-align: right;"><div><span class="card-id">${p.ID_do_Pedido}</span></div>${tO ? '<div><span class="observacao-tag">OBSERVAÇÃO</span></div>' : ''}</div></div><br><div class="card-title">${p.Nome_Cliente}</div><div class="card-info-box"><div class="card-info-row"><span class="card-icon">🗓️</span> ${p.Data_Entrega || '--/--/----'}</div><div class="card-info-row"><span class="card-icon">⏰</span> ${p.Horario_Entrega || '--:--'}</div><div class="card-info-row"><span class="card-icon">📱</span> <span class="card-numero-text">${p.Numero || 'N/A'}</span></div></div>${cupomDescontoHTML ? `<div class="card-cupom">${cupomDescontoHTML}</div>` : ''}${taxaPagamentoHTML}<div class="card-price"><span>R$ ${formatarNumeroMoedaPedido(totalExibicaoPedido)}</span>${tt ? `<span class="payment-type-tag ${tc}">${tt}</span>` : ''}</div><div class="card-status-pagamento"><select class="${pC}" onchange="window.atualizarStatusPagamentoDireto('${p.ID_do_Pedido}', this)"><option value="Pendente" ${pg === 'pendente' || pg === 'pagamento pendente' ? 'selected' : ''}>Pendente</option><option value="Pago 50%" ${pg.includes('50') ? 'selected' : ''}>Pago 50%</option><option value="Pago 100%" ${pg.includes('100') || pg === 'pago' ? 'selected' : ''}>Pago 100%</option></select></div><div class="card-pedido-actions"><button type="button" class="btn-card-mini btn-card-whatsapp" title="Contato" aria-label="Contato" onclick="window.abrirModalWhatsApp('${p.ID_do_Pedido}'); event.stopPropagation();"><i class="fab fa-whatsapp"></i></button><button type="button" class="btn-card-mini btn-card-copy" title="Copiar" aria-label="Copiar" onclick="window.copiarPedido('${p.ID_do_Pedido}'); event.stopPropagation();"><i class="fas fa-copy"></i></button><button type="button" class="btn-card-mini btn-card-delete" title="Excluir" aria-label="Excluir" onclick="window.excluirPedidoLogico('${p.ID_do_Pedido}'); event.stopPropagation();"><i class="fas fa-trash"></i></button></div>`;
    return c;
}



window.copiarPedido = function(id) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === id);
    if (!p) return;

    const tituloModalPedido = document.querySelector('#edit-modal-pedido .modal-header h3');
    if (tituloModalPedido) tituloModalPedido.textContent = 'Copiar Pedido';

    const novoId = gerarPedidoId('CPD');

    window.editPedidoModoCopia = true;
    window.editPedidoIdCopiaOriginal = id;
    window.editPedidoStatusCopia = p.Status_do_Pedido || 'Pedidos Orçados';

    document.getElementById('modal-id-display').textContent = `#${novoId}`;
    document.getElementById('edit-id-pedido').value = novoId;
    document.getElementById('edit-nome-pedido').value = p.Nome_Cliente || '';
    document.getElementById('edit-telefone-pedido').value = p.Numero || '';

    const dataPedidoInput = document.getElementById('edit-data-pedido');
    if (dataPedidoInput) dataPedidoInput.value = formatarDataParaInputPedido(p.Data_Entrega);

    const horaPedidoInput = document.getElementById('edit-hora-pedido');
    if (horaPedidoInput && horaPedidoInput.tagName === 'SELECT') garantirValorSelectPedido(horaPedidoInput, p.Horario_Entrega || '');
    else if (horaPedidoInput) horaPedidoInput.value = normalizarHoraPedidoManual(p.Horario_Entrega || '') || p.Horario_Entrega || '';

    const descontoManualExistente = extrairDescontoManualPedido(p.Cupom || '');
    const cupomSemDescontoManual = extrairCodigoCupomPedido(p.Cupom || '');

    document.getElementById('edit-forma-pedido').value = normalizarFormaPagamentoPedido(p.Forma_de_Pagamento || 'Pix');
    if (document.getElementById('edit-forma-pedido').value === 'Crédito') {
        const modalidadeLegada = getModalidadeCreditoPedido(p).toLowerCase();
        if (modalidadeLegada.includes('link')) document.getElementById('edit-forma-pedido').value = 'Crédito Link';
        else if (modalidadeLegada.includes('retirada')) document.getElementById('edit-forma-pedido').value = 'Crédito Retirada';
    }
    document.getElementById('edit-status-pgto-pedido').value = normalizarStatusPagamentoPedido(p.Status_Pagamento || 'Pendente');
    document.getElementById('edit-cupom-pedido').value = cupomSemDescontoManual;
    document.getElementById('edit-total-pedido').value = p.Total_Final || '';
    document.getElementById('edit-obs-pedido').value = p.Observacoes || '';
    document.getElementById('edit-resumo-pedido').value = p.Resumo_dos_Itens || '';

    const cupomStatusEdit = document.getElementById('edit-cupom-status');
    if (cupomStatusEdit) { cupomStatusEdit.textContent = ''; cupomStatusEdit.className = 'edit-cupom-status'; }

    window.editCupomPedidoOriginal = cupomSemDescontoManual;
    window.editCupomAplicado = null;
    preencherDescontoManualEditPedido(descontoManualExistente);

    window.preencherSelectProdutosAdicionais();
    window.carregarItensEditPedido(p.Resumo_dos_Itens || '');
    window.inicializarNovosItensPedidoEditado();
    window.openModal('edit-modal-pedido');
};

window.excluirPedidoLogico = function(id) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === id);
    if (!p) return;

    const novoId = calcularNovoIdExcluido(id);
    window.customConfirm('Excluir este pedido da lista?', async () => {
        window.mostrarLoading(true);
        try {
            await updateDoc(doc(db, "pedidos", p._docId || id), {
                ID_do_Pedido: novoId,
                Status_do_Pedido: 'Excluído',
                excluido: true,
                excluidoEm: Date.now(),
                idOriginal: id
            });
            window.ticketsSelecionados.delete(id);
            window.todosPedidos = window.todosPedidos.filter(pedido => pedido.ID_do_Pedido !== id);
            window.filtrarPedidos();
            window.showToast("Pedido removido da lista.");
        } catch (err) {
            console.error(err);
            window.showToast("Erro ao excluir pedido.", true);
        }
        window.mostrarLoading(false);
    });
};

window.configurarAcordeaoColunas = function() {
    document.querySelectorAll('.column-header').forEach(h => { const nH = h.cloneNode(true); h.parentNode.replaceChild(nH, h); });
    if (window.innerWidth <= 768) { document.querySelectorAll('.column-header').forEach(h => { h.addEventListener('click', (e) => { if (e.target.type === 'checkbox' || e.target.closest('.column-select-all-checkbox')) return; const c = h.closest('.kanban-column'); if (!c) return; document.querySelectorAll('.kanban-column').forEach(col => { if (col !== c) col.classList.remove('expanded'); }); c.classList.toggle('expanded'); }); }); }
}

window.allowDrop = function(e) {
    e.preventDefault();
};

window.drag = function(e) {
    // Guarda o ID do card
    e.dataTransfer.setData("text", e.target.dataset.id);
    
    // Pequeno delay pra ele não achar que você soltou no mesmo milissegundo que clicou
    setTimeout(() => {
        e.target.style.opacity = '0.5';
    }, 0);
};

window.dragEnd = function(e) {
    e.target.style.opacity = '1';
};

window.drop = async function(e) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text");
    const coluna = e.target.closest('.kanban-column');
    
    if (!coluna) return;
    
    const novoStatus = coluna.dataset.status;
    const card = document.getElementById(`card-${id}`);
    
    if (card) {
        card.style.opacity = '1';
        coluna.querySelector('.column-content').appendChild(card);
        
        window.mostrarLoading(true);
        try {
            await updateDoc(doc(db, "pedidos", getPedidoDocumentoId(id)), { Status_do_Pedido: novoStatus });
            window.showToast("Status atualizado!");
        } catch (err) {
            window.showToast("Erro ao mover pedido", true);
        }
        window.mostrarLoading(false);
    }
};
window.toggleSelecao = function(id, cb) { if(cb.checked) window.ticketsSelecionados.add(id); else window.ticketsSelecionados.delete(id); window.atualizarBarraAcoesPedidos(); }
window.toggleSelectColumn = function(cb, s) { document.querySelector(`.kanban-column[data-status="${s}"]`).querySelectorAll('.card-checkbox').forEach(c => { c.checked = cb.checked; window.toggleSelecao(c.closest('.pedido-card').dataset.id, c); }); }
window.atualizarBarraAcoesPedidos = function() { const bar = document.getElementById('bulk-actions-bar-pedidos'); if(document.getElementById('selected-count-pedidos')) document.getElementById('selected-count-pedidos').textContent = `${window.ticketsSelecionados.size} itens`; if(bar) bar.style.display = window.ticketsSelecionados.size > 0 ? 'flex' : 'none'; window.atualizarDashboardPedidos(); }
window.limparSelecaoPedidos = function() { window.ticketsSelecionados.clear(); document.querySelectorAll('.card-checkbox, .column-select-all-checkbox').forEach(cb => cb.checked = false); window.atualizarBarraAcoesPedidos(); }

window.abrirBulkMove = function() { document.getElementById('bulk-move-modal').style.display = 'flex'; }
window.executarBulkMove = async function() { const nS = document.getElementById('bulk-move-select').value; window.mostrarLoading(true); await Promise.all(Array.from(window.ticketsSelecionados).map(id => updateDoc(doc(db, "pedidos", getPedidoDocumentoId(id)), { Status_do_Pedido: nS }))); window.mostrarLoading(false); document.getElementById('bulk-move-modal').style.display = 'none'; window.limparSelecaoPedidos(); window.showToast("Pedidos movidos!"); }
window.abrirBulkPayment = function() { document.getElementById('bulk-payment-modal').style.display = 'flex'; }
window.executarBulkPayment = async function() { const nS = document.getElementById('bulk-payment-select').value; window.mostrarLoading(true); await Promise.all(Array.from(window.ticketsSelecionados).map(id => updateDoc(doc(db, "pedidos", getPedidoDocumentoId(id)), { Status_Pagamento: nS }))); window.mostrarLoading(false); document.getElementById('bulk-payment-modal').style.display = 'none'; window.limparSelecaoPedidos(); window.showToast("Pagamentos atualizados!"); }
window.atualizarStatusPagamentoDireto = async function(id, sel) { window.mostrarLoading(true); try { await updateDoc(doc(db, "pedidos", getPedidoDocumentoId(id)), { Status_Pagamento: sel.value }); window.showToast("Pagamento Atualizado!"); } catch (err) { window.showToast("Erro ao salvar", true); } window.mostrarLoading(false); }

window.abrirModalEdicao = function(id) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === id); if(!p) return;
    const tituloModalPedido = document.querySelector('#edit-modal-pedido .modal-header h3');
    if (tituloModalPedido) tituloModalPedido.textContent = 'Editar Pedido';
    window.editPedidoModoCopia = false;
    window.editPedidoIdCopiaOriginal = '';
    window.editPedidoStatusCopia = p.Status_do_Pedido || 'Pedidos Orçados';
    document.getElementById('modal-id-display').textContent = `#${id}`; document.getElementById('edit-id-pedido').value = id; document.getElementById('edit-nome-pedido').value = p.Nome_Cliente || ''; document.getElementById('edit-telefone-pedido').value = p.Numero || '';

    const dataPedidoInput = document.getElementById('edit-data-pedido');
    if (dataPedidoInput) dataPedidoInput.value = formatarDataParaInputPedido(p.Data_Entrega);

    const horaPedidoInput = document.getElementById('edit-hora-pedido');
    if (horaPedidoInput && horaPedidoInput.tagName === 'SELECT') garantirValorSelectPedido(horaPedidoInput, p.Horario_Entrega || '');
    else if (horaPedidoInput) horaPedidoInput.value = normalizarHoraPedidoManual(p.Horario_Entrega || '') || p.Horario_Entrega || '';

    const descontoManualExistente = extrairDescontoManualPedido(p.Cupom || '');
    const cupomSemDescontoManual = extrairCodigoCupomPedido(p.Cupom || '');
    document.getElementById('edit-forma-pedido').value = normalizarFormaPagamentoPedido(p.Forma_de_Pagamento || 'Pix');
    if (document.getElementById('edit-forma-pedido').value === 'Crédito') {
        const modalidadeLegada = getModalidadeCreditoPedido(p).toLowerCase();
        if (modalidadeLegada.includes('link')) document.getElementById('edit-forma-pedido').value = 'Crédito Link';
        else if (modalidadeLegada.includes('retirada')) document.getElementById('edit-forma-pedido').value = 'Crédito Retirada';
    } document.getElementById('edit-status-pgto-pedido').value = normalizarStatusPagamentoPedido(p.Status_Pagamento || 'Pendente'); document.getElementById('edit-cupom-pedido').value = cupomSemDescontoManual; document.getElementById('edit-total-pedido').value = p.Total_Final || ''; document.getElementById('edit-obs-pedido').value = p.Observacoes || ''; document.getElementById('edit-resumo-pedido').value = p.Resumo_dos_Itens || '';
    const cupomStatusEdit = document.getElementById('edit-cupom-status');
    if (cupomStatusEdit) { cupomStatusEdit.textContent = ''; cupomStatusEdit.className = 'edit-cupom-status'; }
    window.editCupomPedidoOriginal = cupomSemDescontoManual;
    window.editCupomAplicado = null;
    preencherDescontoManualEditPedido(descontoManualExistente);
    window.preencherSelectProdutosAdicionais();
    window.carregarItensEditPedido(p.Resumo_dos_Itens || '');
    window.inicializarNovosItensPedidoEditado();
    window.openModal('edit-modal-pedido');
}


window.editPedidoItens = [];
window.editPedidoNovosItens = [];
window.editPedidoModoCopia = false;
window.editPedidoIdCopiaOriginal = '';
window.editPedidoStatusCopia = 'Pedidos Orçados';
window.editCupomAplicado = null;
window.editCupomPedidoOriginal = '';
window.editDescontoManualAplicado = 0;

function gerarIdItemEditPedido() {
    return `edititem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizarTextoPedido(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
}

function encontrarProdutoPorTextoPedido(nome) {
    const alvo = normalizarTextoPedido(nome);
    if (!alvo) return null;

    return allProducts.find(p => {
        const nomeProduto = normalizarTextoPedido(p.nome);
        const resumo = normalizarTextoPedido(p.descricaoResumo);
        const tamanho = normalizarTextoPedido(p.tamanho);
        const composto = normalizarTextoPedido(`${p.nome || ''} ${p.tamanho || ''}`);
        return alvo === nomeProduto || alvo === resumo || alvo === composto || (tamanho && alvo === `${nomeProduto} - ${tamanho}`);
    }) || allProducts.find(p => {
        const nomeProduto = normalizarTextoPedido(p.nome);
        const resumo = normalizarTextoPedido(p.descricaoResumo);
        return (nomeProduto && alvo.includes(nomeProduto)) || (resumo && alvo.includes(resumo));
    }) || null;
}

function parseResumoEditPedido(texto) {
    const itens = [];
    let categoriaAtual = 'Sem categoria';

    String(texto || '').split(/\r?\n/).forEach(linhaOriginal => {
        const linha = normalizarLinhaResumoPedido(linhaOriginal);
        if (!linha) return;

        const semDoisPontos = linha.replace(/:$/, '').trim();
        const pareceCategoria = !/\d+\s*(?:x|un|un\.|unidade|unidades)/i.test(linha) && !/R\$/i.test(linha);
        if ((linha.endsWith(':') || pareceCategoria) && semDoisPontos && semDoisPontos.length <= 60) {
            categoriaAtual = semDoisPontos;
            return;
        }

        if (/desconto|valor dos itens|total|bruto|liquido|líquido/i.test(linha)) return;

        let qtd = 0;
        let nome = linha;
        let preco = 0;
        let m = linha.match(/^(\d+)\s*(?:x|un\.?|unidades?)?\s*[-–]?\s*(.+)$/i);
        if (m) {
            qtd = parseInt(m[1], 10) || 0;
            nome = m[2].trim();
        } else {
            return;
        }

        const totalMatch = nome.match(/=\s*R\$\s*([\d.,]+)/i);
        const totalLinha = totalMatch ? converterValorParaNumero(totalMatch[1]) : 0;
        nome = nome.replace(/=\s*R\$\s*[\d.,]+/i, '').trim();

        const precoMatch = nome.match(/\(R\$\s*([\d.,]+)\s*(?:cada)?\)/i);
        if (precoMatch) {
            preco = converterValorParaNumero(precoMatch[1]);
            nome = nome.replace(/\(R\$\s*[\d.,]+\s*(?:cada)?\)/i, '').trim();
        }

        nome = nome.replace(/\s*-\s*$/g, '').trim();
        if (!preco && totalLinha && qtd) preco = totalLinha / qtd;

        const produto = encontrarProdutoPorTextoPedido(nome);
        itens.push({
            id: gerarIdItemEditPedido(),
            produtoId: produto ? produto.id : '__OUTROS__',
            nome: produto ? (produto.tamanho ? `${produto.nome} - ${produto.tamanho}` : produto.nome) : nome,
            categoria: produto ? (produto.categoria || 'Geral') : (categoriaAtual || 'Outros'),
            qtd: qtd || 1,
            preco: produto ? (converterValorParaNumero(produto.preco) || preco || 0) : (preco || 0),
            outros: !produto
        });
    });

    return itens;
}

function montarOptionsProdutosEditPedido(selectedId) {
    let html = '<option value="">Selecione...</option><option value="__OUTROS__" ' + (selectedId === '__OUTROS__' ? 'selected' : '') + '>Outros</option>';
    [...allProducts].sort(sortProducts).forEach(p => {
        const nome = p.tamanho ? `${p.nome} - ${p.tamanho}` : p.nome;
        html += `<option value="${p.id}" ${selectedId === p.id ? 'selected' : ''}>${nome}</option>`;
    });
    return html;
}

function getProdutoEditPedido(id) {
    return allProducts.find(p => p.id === id) || null;
}

function getSubtotalEditPedido() {
    return window.editPedidoItens.reduce((acc, item) => acc + ((parseInt(item.qtd) || 0) * (parseFloat(item.preco) || 0)), 0);
}

function getDescontoManualEditPedido() {
    const campo = document.getElementById('edit-desconto-pedido');
    return Math.max(0, Math.abs(converterValorParaNumero(campo?.value || '0')) || 0);
}

function atualizarResumoHiddenEditPedido() {
    const grupos = {};
    window.editPedidoItens.forEach(item => {
        const qtd = parseInt(item.qtd) || 0;
        const preco = parseFloat(item.preco) || 0;
        const nome = (item.nome || '').trim();
        if (!qtd || !nome) return;

        const categoria = item.categoria || 'Sem categoria';
        if (!grupos[categoria]) grupos[categoria] = [];
        grupos[categoria].push(`${qtd} un. - ${nome} (R$ ${preco.toFixed(2).replace('.', ',')}) = R$ ${(qtd * preco).toFixed(2).replace('.', ',')}`);
    });

    let texto = '';
    Object.keys(grupos).forEach(cat => {
        texto += `- ${cat}:\n`;
        texto += grupos[cat].join('\n') + '\n\n';
    });

    const cupomDesc = window.editCupomAplicado?.desconto || 0;
    const codigoCupomAplicado = window.editCupomAplicado?.codigo || '';
    const descontoManualAplicado = window.editDescontoManualAplicado || 0;
    const descontoTotal = cupomDesc + descontoManualAplicado;

    if (codigoCupomAplicado || descontoTotal > 0) {
        texto += '- Descontos:\n';
        if (codigoCupomAplicado) texto += `Cupom: ${codigoCupomAplicado}\n`;
        if (descontoTotal > 0) texto += `Desconto: -R$ ${formatarNumeroMoedaPedido(descontoTotal)}\n`;
    }

    const hidden = document.getElementById('edit-resumo-pedido');
    if (hidden) hidden.value = texto.trim();
}

window.recalcularPedidoEditado = function() {
    const subtotal = getSubtotalEditPedido();
    const cupomDesc = window.editCupomAplicado?.desconto || 0;
    const descontoManual = getDescontoManualEditPedido();
    window.editDescontoManualAplicado = descontoManual;
    const total = Math.max(0, subtotal - cupomDesc - descontoManual);
    const totalEl = document.getElementById('edit-total-pedido');
    if (totalEl) totalEl.value = formatarNumeroMoedaPedido(total);
    atualizarResumoHiddenEditPedido();
};

window.renderItensPedidoEdit = function() {
    const container = document.getElementById('edit-itens-pedido-list');
    if (!container) return;

    if (!window.editPedidoItens.length) {
        container.innerHTML = '<div style="font-family:var(--font-numbers); color:#777; text-align:center; padding:10px;">Nenhum item no pedido.</div>';
        window.recalcularPedidoEditado();
        return;
    }

    let html = '';
    let categoriaAtual = null;

    const itensOrdenados = [...window.editPedidoItens].sort((a, b) => {
        const cat = (a.categoria || 'Sem categoria').localeCompare(b.categoria || 'Sem categoria', 'pt-BR');
        if (cat !== 0) return cat;
        return (a.nome || '').localeCompare(b.nome || '', 'pt-BR');
    });

    // NOVO (2026-08): agrupa visualmente variações de tamanho do mesmo produto (ex.: "Bolo - P"/"Bolo - M"/"Bolo - G"),
    // mostrando nome e categoria uma única vez — só quando há mais de uma variação do mesmo produto neste pedido.
    // Isso NÃO altera cálculo, salvamento ou o array window.editPedidoItens: cada linha continua com seu
    // próprio select/valor/qtd escondido no DOM, só a apresentação visual muda.
    const extrairNomeBaseSufixoPedido = (nome) => {
        const texto = String(nome || '').trim();
        const m = texto.match(/^(.*)\s-\s([^-]+)$/);
        return m ? { base: m[1].trim(), sufixo: m[2].trim() } : { base: texto, sufixo: '' };
    };
    const contagemGrupoItemPedido = {};
    itensOrdenados.forEach(item => {
        if (item.outros) return;
        const { base, sufixo } = extrairNomeBaseSufixoPedido(item.nome);
        if (!sufixo) return;
        const chave = `${item.categoria || ''}|||${base.toLowerCase()}`;
        contagemGrupoItemPedido[chave] = (contagemGrupoItemPedido[chave] || 0) + 1;
    });

    let grupoItemPedidoAtual = null;

    itensOrdenados.forEach(item => {
        const categoria = item.categoria || 'Sem categoria';
        if (categoria !== categoriaAtual) {
            categoriaAtual = categoria;
            html += `<div class="edit-item-category">${categoria}</div>`;
            grupoItemPedidoAtual = null;
        }

        const { base, sufixo } = extrairNomeBaseSufixoPedido(item.nome);
        const chaveGrupo = `${categoria}|||${base.toLowerCase()}`;
        const ehVariacaoAgrupavel = !item.outros && sufixo && contagemGrupoItemPedido[chaveGrupo] > 1;
        const ehPrimeiraDoGrupo = chaveGrupo !== grupoItemPedidoAtual;
        if (ehVariacaoAgrupavel) grupoItemPedidoAtual = chaveGrupo;

        if (ehVariacaoAgrupavel && ehPrimeiraDoGrupo) {
            html += `<div class="edit-item-produto-header"><i class="fas fa-utensils"></i> ${base}</div>`;
        }

        const celulaProduto = ehVariacaoAgrupavel
            ? `<span class="edit-item-variacao-label">Tamanho ${sufixo}</span><select style="display:none;" onchange="window.atualizarItemPedidoSelect('${item.id}', this.value)">${montarOptionsProdutosEditPedido(item.produtoId)}</select>`
            : `<select onchange="window.atualizarItemPedidoSelect('${item.id}', this.value)">${montarOptionsProdutosEditPedido(item.produtoId)}</select>
               <input class="edit-outros-name" type="text" value="${String(item.nome || '').replace(/"/g, '&quot;')}" placeholder="Nome do item" ${item.outros ? '' : 'readonly style="display:none;"'} oninput="window.atualizarItemPedidoCampo('${item.id}', 'nome', this.value)">`;

        const total = (parseInt(item.qtd) || 0) * (parseFloat(item.preco) || 0);
        html += `
            <div class="edit-item-row${ehVariacaoAgrupavel ? ' edit-item-row-variacao' : ''}" data-id="${item.id}">
                <div class="edit-item-product-cell">
                    ${celulaProduto}
                </div>
                <div>
                    <label>Unid.</label>
                    <input type="number" min="1" value="${parseInt(item.qtd) || 1}" oninput="window.atualizarItemPedidoCampo('${item.id}', 'qtd', this.value)">
                </div>
                <div>
                    <label>Valor Unid.</label>
                    <input type="number" step="0.01" min="0" value="${(parseFloat(item.preco) || 0).toFixed(2)}" ${item.outros ? '' : 'readonly'} oninput="window.atualizarItemPedidoCampo('${item.id}', 'preco', this.value)">
                </div>
                <div class="edit-item-total-cell">
                    <label>Total</label>
                    <input class="edit-item-total" type="text" value="R$ ${formatarNumeroMoedaPedido(total)}" readonly>
                </div>
                <div>
                    <label>&nbsp;</label>
                    <button type="button" class="btn btn-danger edit-item-remove" onclick="window.removerItemPedidoEdit('${item.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });

    const cupomAplicadoCodigo = (
        window.editCupomAplicado?.codigo ||
        (document.getElementById('edit-cupom-pedido')?.value || '').trim().toUpperCase()
    );
    const cupomDesconto = window.editCupomAplicado?.desconto || 0;
    const descontoManual = window.editDescontoManualAplicado || 0;
    const descontoTotal = cupomDesconto + descontoManual;

    if (cupomAplicadoCodigo || descontoTotal > 0) {
        let descontoHtml = '';
        if (cupomAplicadoCodigo) {
            descontoHtml += `<div class="edit-discount-row">Cupom: ${escapeHtmlPedido(cupomAplicadoCodigo)}</div>`;
        }
        if (descontoTotal > 0) {
            descontoHtml += `<div class="edit-discount-row">Desconto aplicado: -R$ ${formatarNumeroMoedaPedido(descontoTotal)}</div>`;
        }
        html += descontoHtml;
    }

    container.innerHTML = html;
    window.recalcularPedidoEditado();
};

window.carregarItensEditPedido = function(resumo) {
    window.editPedidoItens = parseResumoEditPedido(resumo);
    if (!window.editPedidoItens.length && resumo && resumo.trim()) {
        window.editPedidoItens = [{
            id: gerarIdItemEditPedido(),
            produtoId: '__OUTROS__',
            nome: 'Itens do pedido',
            categoria: 'Outros',
            qtd: 1,
            preco: converterValorParaNumero(document.getElementById('edit-total-pedido')?.value || '0'),
            outros: true
        }];
    }
    window.renderItensPedidoEdit();
};

window.preencherSelectProdutosAdicionais = function() {
    // Mantida por compatibilidade: as opções agora são montadas em cada linha de "Itens do Pedido".
};

window.toggleCamposOutros = function() {
    // Mantida por compatibilidade com versões anteriores do modal.
};

window.atualizarItemPedidoSelect = function(itemId, produtoId) {
    const item = window.editPedidoItens.find(i => i.id === itemId);
    if (!item) return;

    if (produtoId === '__OUTROS__') {
        item.produtoId = '__OUTROS__';
        item.outros = true;
        item.categoria = item.categoria || 'Outros';
        item.nome = item.nome || '';
        item.preco = parseFloat(item.preco) || 0;
    } else {
        const produto = getProdutoEditPedido(produtoId);
        if (!produto) return;
        item.produtoId = produto.id;
        item.outros = false;
        item.nome = produto.tamanho ? `${produto.nome} - ${produto.tamanho}` : produto.nome;
        item.categoria = produto.categoria || 'Geral';
        item.preco = converterValorParaNumero(produto.preco) || 0;
    }

    window.editCupomAplicado = null;
    const status = document.getElementById('edit-cupom-status');
    if (status) { status.textContent = ''; status.className = 'edit-cupom-status'; }
    window.renderItensPedidoEdit();
};

window.atualizarItemPedidoCampo = function(itemId, campo, valor) {
    const item = window.editPedidoItens.find(i => i.id === itemId);
    if (!item) return;

    if (campo === 'qtd') item.qtd = Math.max(1, parseInt(valor) || 1);
    else if (campo === 'preco') item.preco = Math.max(0, converterValorParaNumero(valor) || 0);
    else if (campo === 'nome') item.nome = valor;

    if (campo === 'qtd' || campo === 'preco') {
        window.renderItensPedidoEdit();
    } else {
        window.recalcularPedidoEditado();
    }
};

window.removerItemPedidoEdit = function(itemId) {
    window.editPedidoItens = window.editPedidoItens.filter(i => i.id !== itemId);
    window.renderItensPedidoEdit();
};

function criarNovoItemPendenteEditPedido() {
    return {
        id: gerarIdItemEditPedido(),
        produtoId: '',
        nome: '',
        categoria: 'Outros',
        qtd: 1,
        preco: 0,
        outros: false
    };
}

window.inicializarNovosItensPedidoEditado = function() {
    window.editPedidoNovosItens = [criarNovoItemPendenteEditPedido()];
    window.renderNovosItensPedidoEdit();
};

window.renderNovosItensPedidoEdit = function() {
    const container = document.getElementById('edit-novos-itens-list');
    if (!container) return;

    if (!window.editPedidoNovosItens.length) {
        window.editPedidoNovosItens = [criarNovoItemPendenteEditPedido()];
    }

    let html = '';
    window.editPedidoNovosItens.forEach((item, index) => {
        const total = (parseInt(item.qtd) || 0) * (parseFloat(item.preco) || 0);
        const mostrarNomeOutros = item.produtoId === '__OUTROS__' || item.outros;

        html += `
            <div class="edit-novo-item-row" data-id="${item.id}">
                <div class="edit-novo-item-product-cell">
                    <select onchange="window.atualizarNovoItemPedidoSelect('${item.id}', this.value)">${montarOptionsProdutosEditPedido(item.produtoId)}</select>
                    <input class="edit-outros-name" type="text" value="${String(item.nome || '').replace(/"/g, '&quot;')}" placeholder="Nome do item" ${mostrarNomeOutros ? '' : 'readonly style="display:none;"'} oninput="window.atualizarNovoItemPedidoCampo('${item.id}', 'nome', this.value)">
                </div>
                <div>
                    <label>Unid.</label>
                    <input type="number" min="1" value="${parseInt(item.qtd) || 1}" oninput="window.atualizarNovoItemPedidoCampo('${item.id}', 'qtd', this.value)">
                </div>
                <div>
                    <label>Valor Unid.</label>
                    <input type="number" step="0.01" min="0" value="${(parseFloat(item.preco) || 0).toFixed(2)}" ${mostrarNomeOutros ? '' : 'readonly'} oninput="window.atualizarNovoItemPedidoCampo('${item.id}', 'preco', this.value)">
                </div>
                <div>
                    <label>Total</label>
                    <input class="edit-item-total edit-novo-item-total" type="text" value="R$ ${formatarNumeroMoedaPedido(total)}" readonly>
                </div>
                <div>
                    <label>&nbsp;</label>
                    <button type="button" class="btn edit-novo-item-confirm" onclick="window.confirmarNovoItemPedidoEdit('${item.id}')" title="Adicionar item"><i class="fas fa-check"></i></button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.adicionarLinhaNovoItemPedido = function() {
    window.editPedidoNovosItens.push(criarNovoItemPendenteEditPedido());
    window.renderNovosItensPedidoEdit();
};

window.adicionarItemAoResumoPedido = function() {
    window.adicionarLinhaNovoItemPedido();
};

window.atualizarNovoItemPedidoSelect = function(itemId, produtoId) {
    const item = window.editPedidoNovosItens.find(i => i.id === itemId);
    if (!item) return;

    if (!produtoId) {
        item.produtoId = '';
        item.outros = false;
        item.nome = '';
        item.categoria = 'Outros';
        item.preco = 0;
    } else if (produtoId === '__OUTROS__') {
        item.produtoId = '__OUTROS__';
        item.outros = true;
        item.categoria = 'Outros';
        item.nome = '';
        item.preco = 0;
    } else {
        const produto = getProdutoEditPedido(produtoId);
        if (!produto) return;
        item.produtoId = produto.id;
        item.outros = false;
        item.nome = produto.tamanho ? `${produto.nome} - ${produto.tamanho}` : produto.nome;
        item.categoria = produto.categoria || 'Geral';
        item.preco = converterValorParaNumero(produto.preco) || 0;
    }

    window.renderNovosItensPedidoEdit();
};

window.atualizarNovoItemPedidoCampo = function(itemId, campo, valor) {
    const item = window.editPedidoNovosItens.find(i => i.id === itemId);
    if (!item) return;

    if (campo === 'qtd') item.qtd = Math.max(1, parseInt(valor) || 1);
    else if (campo === 'preco') item.preco = Math.max(0, converterValorParaNumero(valor) || 0);
    else if (campo === 'nome') item.nome = valor;

    if (campo === 'qtd' || campo === 'preco') {
        window.renderNovosItensPedidoEdit();
    }
};

window.removerNovoItemPedidoEdit = function(itemId) {
    window.editPedidoNovosItens = window.editPedidoNovosItens.filter(i => i.id !== itemId);
    if (!window.editPedidoNovosItens.length) window.editPedidoNovosItens = [criarNovoItemPendenteEditPedido()];
    window.renderNovosItensPedidoEdit();
};

function isNovoItemPedidoVazio(item) {
    return !item || (!item.produtoId && !String(item.nome || '').trim() && !(parseFloat(item.preco) > 0));
}

function validarNovoItemPedidoPendente(item) {
    if (isNovoItemPedidoVazio(item)) {
        window.showToast("Preencha o item antes de adicionar.", true);
        return null;
    }

    if (!item.produtoId) {
        window.showToast("Selecione o item antes de adicionar.", true);
        return null;
    }

    if ((item.produtoId === '__OUTROS__' || item.outros) && !String(item.nome || '').trim()) {
        window.showToast("Informe o nome do item em Outros antes de adicionar.", true);
        return null;
    }

    const qtd = Math.max(1, parseInt(item.qtd) || 1);
    const preco = Math.max(0, parseFloat(item.preco) || 0);

    if (item.produtoId === '__OUTROS__' && preco <= 0) {
        window.showToast("Informe o valor unitário do item em Outros antes de adicionar.", true);
        return null;
    }

    return {
        id: gerarIdItemEditPedido(),
        produtoId: item.produtoId,
        nome: item.nome,
        categoria: item.produtoId === '__OUTROS__' ? 'Outros' : (item.categoria || 'Geral'),
        qtd,
        preco,
        outros: item.produtoId === '__OUTROS__' || item.outros
    };
}

window.confirmarNovoItemPedidoEdit = function(itemId) {
    const item = window.editPedidoNovosItens.find(i => i.id === itemId);
    const itemValidado = validarNovoItemPedidoPendente(item);
    if (!itemValidado) return;

    window.editPedidoItens.push(itemValidado);
    window.editPedidoNovosItens = window.editPedidoNovosItens.filter(i => i.id !== itemId);
    if (!window.editPedidoNovosItens.length) {
        window.editPedidoNovosItens = [criarNovoItemPendenteEditPedido()];
    }

    window.renderItensPedidoEdit();
    window.renderNovosItensPedidoEdit();
    window.showToast("Item adicionado ao pedido!");
};

function incorporarNovosItensPedidoEditado() {
    const pendentesPreenchidos = (window.editPedidoNovosItens || []).filter(item => !isNovoItemPedidoVazio(item));

    if (pendentesPreenchidos.length) {
        window.showToast("Clique no check para adicionar o item antes de salvar.", true);
        return false;
    }

    return true;
};

window.onInputDescontoEditPedido = function() {
    const valorDigitado = getDescontoManualEditPedido();
    const status = document.getElementById('edit-desconto-status');

    window.editDescontoManualAplicado = valorDigitado;

    if (status) {
        if (valorDigitado > 0) {
            status.textContent = `Desconto aplicado: -R$ ${formatarNumeroMoedaPedido(valorDigitado)}`;
            status.className = 'edit-cupom-status ok';
        } else {
            status.textContent = '';
            status.className = 'edit-cupom-status';
        }
    }

    window.recalcularPedidoEditado();
};

window.aplicarDescontoManualEditPedido = function() {
    const valor = getDescontoManualEditPedido();
    const status = document.getElementById('edit-desconto-status');

    window.editDescontoManualAplicado = valor;

    if (status) {
        if (valor > 0) {
            status.textContent = `Desconto aplicado: -R$ ${formatarNumeroMoedaPedido(valor)}`;
            status.className = 'edit-cupom-status ok';
        } else {
            status.textContent = '';
            status.className = 'edit-cupom-status';
        }
    }

    window.renderItensPedidoEdit();
    window.recalcularPedidoEditado();
};

window.resetarCupomEditPedido = function() {
    window.editCupomAplicado = null;
    const status = document.getElementById('edit-cupom-status');
    if (status) { status.textContent = ''; status.className = 'edit-cupom-status'; }
    window.renderItensPedidoEdit();
    window.recalcularPedidoEditado();
};

window.validarCupomEditPedido = async function() {
    const input = document.getElementById('edit-cupom-pedido');
    const status = document.getElementById('edit-cupom-status');
    const codigo = (input?.value || '').trim().toUpperCase();
    const subtotal = getSubtotalEditPedido();

    window.editCupomAplicado = null;
    if (status) { status.textContent = ''; status.className = 'edit-cupom-status'; }

    try {
        const resultado = await validarCupomAdmin(codigo, subtotal);
        if (!resultado.ok) {
            if (status) { status.textContent = resultado.motivo; status.className = 'edit-cupom-status erro'; }
            window.recalcularPedidoEditado();
            return;
        }

        window.editCupomAplicado = { codigo: resultado.codigo, desconto: resultado.desconto };
        if (input) input.value = resultado.codigo;
        if (status) {
            status.textContent = `Cupom aplicado: -R$ ${formatarNumeroMoedaPedido(resultado.desconto)}`;
            status.className = 'edit-cupom-status ok';
        }
        window.renderItensPedidoEdit();
        window.recalcularPedidoEditado();
    } catch (err) {
        console.error(err);
        if (status) { status.textContent = 'Erro ao validar cupom.'; status.className = 'edit-cupom-status erro'; }
        window.recalcularPedidoEditado();
    }
};



window.submitEditForm = async function(e) {
    e.preventDefault(); window.mostrarLoading(true);
    const id = document.getElementById('edit-id-pedido').value;
    const dt = document.getElementById('edit-data-pedido').value;
    const dataEntregaFormatada = dt ? formatarDataInputParaBR(dt) : "";
    const horaPedidoInput = document.getElementById('edit-hora-pedido');
    const horaEntregaFormatada = normalizarHoraPedidoManual(horaPedidoInput?.value || '');

    if (dt && !dataEntregaFormatada) {
        window.mostrarLoading(false);
        window.showToast("Data de entrega inválida.", true);
        return;
    }

    if (!horaEntregaFormatada) {
        window.mostrarLoading(false);
        window.showToast("Horário inválido. Use HH:MM, por exemplo 15:35.", true);
        return;
    }

    if (horaPedidoInput) horaPedidoInput.value = horaEntregaFormatada;

    if (!incorporarNovosItensPedidoEditado()) {
        window.mostrarLoading(false);
        return;
    }

    window.recalcularPedidoEditado();

    const cupomInputAtual = (document.getElementById('edit-cupom-pedido')?.value || '').trim().toUpperCase();
    const cupomOriginal = String(window.editCupomPedidoOriginal || '').trim().toUpperCase();
    const descontoCupom = window.editCupomAplicado?.desconto || 0;
    const codigoCupomAplicado = window.editCupomAplicado?.codigo || (cupomInputAtual && cupomInputAtual === cupomOriginal ? cupomOriginal : '');
    const descontoManual = getDescontoManualEditPedido();
    window.editDescontoManualAplicado = descontoManual;

    const descontoTotal = descontoCupom + descontoManual;
    const cupomFinal = montarCupomDescontoPedido(codigoCupomAplicado, descontoTotal);
    const formaPagamentoEdit = normalizarFormaPagamentoPedido(document.getElementById('edit-forma-pedido').value);
    const modalidadeCreditoEdit = getModalidadeCreditoPedido({ Forma_de_Pagamento: formaPagamentoEdit });

    const totalFinalCalculado = formatarNumeroMoedaPedido(
        Math.max(0, getSubtotalEditPedido() - descontoCupom - descontoManual)
    );
    const dadosTaxaPagamentoEdit = montarDadosTaxaPagamento({
        Forma_de_Pagamento: formaPagamentoEdit,
        Modalidade_Credito: modalidadeCreditoEdit,
        Total_Final: totalFinalCalculado,
        Resumo_dos_Itens: document.getElementById('edit-resumo-pedido')?.value || '',
        Cupom: cupomFinal
    });
    const totalPedidoInput = document.getElementById('edit-total-pedido');
    if (totalPedidoInput) totalPedidoInput.value = totalFinalCalculado;

    try {
        const dadosPedidoEditado = {
            Nome_Cliente: document.getElementById('edit-nome-pedido').value,
            Numero: document.getElementById('edit-telefone-pedido').value,
            Data_Entrega: dataEntregaFormatada,
            Horario_Entrega: horaEntregaFormatada,
            Total_Final: totalFinalCalculado,
            Forma_de_Pagamento: formaPagamentoEdit,
            Modalidade_Credito: modalidadeCreditoEdit,
            ...dadosTaxaPagamentoEdit,
            Status_Pagamento: document.getElementById('edit-status-pgto-pedido').value,
            Cupom: cupomFinal,
            Observacoes: document.getElementById('edit-obs-pedido').value,
            Resumo_dos_Itens: document.getElementById('edit-resumo-pedido').value,
            updatedAt: Date.now()
        };

        if (window.editPedidoModoCopia) {
            await setDoc(doc(db, "pedidos", id), {
                ...dadosPedidoEditado,
                ID_do_Pedido: id,
                Status_do_Pedido: 'Pedidos Orçados',
                origem: 'copia',
                idOriginal: window.editPedidoIdCopiaOriginal || '',
                createdAt: Date.now()
            });
            await ajustarUsoCupomPedidoEditado('', codigoCupomAplicado, true);
            const pedidoCopiadoLocal = {
                ...dadosPedidoEditado,
                ID_do_Pedido: id,
                Status_do_Pedido: 'Pedidos Orçados',
                origem: 'copia',
                idOriginal: window.editPedidoIdCopiaOriginal || '',
                createdAt: Date.now()
            };
            const idxCopia = window.todosPedidos.findIndex(p => p.ID_do_Pedido === id || p._docId === id);
            if (idxCopia >= 0) window.todosPedidos[idxCopia] = { ...window.todosPedidos[idxCopia], ...pedidoCopiadoLocal };
            else window.todosPedidos.push(pedidoCopiadoLocal);

            window.editPedidoModoCopia = false;
            window.editPedidoIdCopiaOriginal = '';
            window.showToast("Pedido copiado!");
        } else {
            await updateDoc(doc(db, "pedidos", getPedidoDocumentoId(id)), dadosPedidoEditado);
            await ajustarUsoCupomPedidoEditado(cupomOriginal, codigoCupomAplicado, false);

            const idxPedido = window.todosPedidos.findIndex(p => p.ID_do_Pedido === id || p._docId === id);
            if (idxPedido >= 0) {
                window.todosPedidos[idxPedido] = { ...window.todosPedidos[idxPedido], ...dadosPedidoEditado };
            }

            window.showToast("Salvo!");
        }

        window.filtrarPedidos();
        window.fecharModalPedido('edit-modal-pedido');
    } catch (err) {
        console.error(err);
        window.showToast("Erro ao salvar!", true);
    }
    window.mostrarLoading(false);
}

function getPedidosSelecionadosOuFiltrados() {
    const selecionados = window.todosPedidos.filter(p => window.ticketsSelecionados.has(p.ID_do_Pedido));
    if (selecionados.length > 0) return selecionados;
    return window.obterPedidosFiltrados();
}

function getDescricaoFiltroAtualPedidos() {
    const displayData = document.getElementById('date-filter-display')?.value || '';
    const busca = document.getElementById('search-input-pedidos')?.value.trim() || '';
    const partes = [];
    if (displayData) partes.push(`Data: ${displayData}`);
    if (busca) partes.push(`Busca: ${busca}`);
    return partes.length ? partes.join(' | ') : 'Filtros atuais';
}

function normalizarLinhaResumoPedido(linha) {
    return String(linha || '')
        .replace(/[*_`]/g, '')
        .replace(/^[•\-–]\s*/, '')
        .trim();
}

function extrairItensResumoPedido(texto) {
    const itens = [];
    let categoriaAtual = 'Sem categoria';
    String(texto || '').split(/\r?\n/).forEach(linhaOriginal => {
        const linha = normalizarLinhaResumoPedido(linhaOriginal);
        if (!linha) return;

        const semDoisPontos = linha.replace(/:$/, '').trim();
        const pareceCategoria = !/\d+\s*(?:x|un|un\.|unidade|unidades)/i.test(linha) && !/R\$/i.test(linha);
        if ((linha.endsWith(':') || pareceCategoria) && semDoisPontos.length > 0 && semDoisPontos.length <= 60) {
            categoriaAtual = semDoisPontos;
            return;
        }

        if (/desconto|valor dos itens|total|bruto|liquido|líquido/i.test(linha)) return;

        let qtd = 0;
        let nome = linha;
        let preco = 0;
        let total = 0;

        let m = linha.match(/^(\d+)\s*(?:x|un\.?|unidades?)?\s*[-–]?\s*(.+)$/i);
        if (m) {
            qtd = parseInt(m[1], 10) || 0;
            nome = m[2].trim();
        }

        const totalMatch = nome.match(/=\s*R\$\s*([\d.,]+)/i);
        if (totalMatch) {
            total = converterValorParaNumero(totalMatch[1]);
            nome = nome.replace(/=\s*R\$\s*[\d.,]+/i, '').trim();
        }

        const precoMatch = nome.match(/\(R\$\s*([\d.,]+)\s*(?:cada)?\)/i);
        if (precoMatch) {
            preco = converterValorParaNumero(precoMatch[1]);
            nome = nome.replace(/\(R\$\s*[\d.,]+\s*(?:cada)?\)/i, '').trim();
        }

        nome = nome.replace(/\s*-\s*$/g, '').trim();
        if (!qtd || !nome) return;
        if (!preco && total && qtd) preco = total / qtd;
        if (!total && preco && qtd) total = preco * qtd;

        itens.push({
            categoria: categoriaAtual || 'Sem categoria',
            nome,
            qtd,
            preco,
            total
        });
    });
    return itens;
}

window.abrirModalResumos = function() {
    const pedidosResumo = getPedidosSelecionadosOuFiltrados();
    if (pedidosResumo.length === 0) return window.showToast("Nenhum pedido no período/filtro atual.", true);
    document.getElementById('resumos-modal').style.display = 'flex';
}

window.gerarListaPedidos = function() {
    const sel = getPedidosSelecionadosOuFiltrados();
    if(sel.length === 0) return window.showToast("Nenhum pedido para listar.", true);

    let t = `Resumo ${sel.length} Pedido(s) - ${getDescricaoFiltroAtualPedidos()}:\n\n`;
    ordenarPedidosPorDataHorario([...sel]).forEach((p, i) => {
        t += `Pedido ${i + 1}\n\n* ${p.Nome_Cliente}\n   ⤷ ${p.Data_Entrega || '--/--/----'} às ${p.Horario_Entrega || '--:--'}\n   ⤷ ${p.ID_do_Pedido}\n\n*- Itens:*\n\n${p.Resumo_dos_Itens ? p.Resumo_dos_Itens : 'Sem itens descritos'}\n\n*Total:* R$ ${formatarValorComCentavos(p.Total_Final)}\n\n------------------------------------------\n\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
    document.getElementById('resumos-modal').style.display = 'none';
}

window.gerarResumoItens = function() {
    const pedidos = getPedidosSelecionadosOuFiltrados();
    if (pedidos.length === 0) return window.showToast("Nenhum pedido para agrupar.", true);

    const agrupados = {};
    pedidos.forEach(p => {
        extrairItensResumoPedido(p.Resumo_dos_Itens || '').forEach(item => {
            const cat = item.categoria || 'Sem categoria';
            const chave = `${cat}|||${item.nome.toLowerCase()}|||${Number(item.preco || 0).toFixed(2)}`;
            if (!agrupados[cat]) agrupados[cat] = {};
            if (!agrupados[cat][chave]) agrupados[cat][chave] = { ...item, qtd: 0, total: 0 };
            agrupados[cat][chave].qtd += item.qtd;
            agrupados[cat][chave].total += item.total || (item.preco * item.qtd);
        });
    });

    let t = `Lista de Itens - ${pedidos.length} pedido(s) - ${getDescricaoFiltroAtualPedidos()}\n\n`;
    Object.keys(agrupados).sort((a, b) => a.localeCompare(b, 'pt-BR')).forEach(cat => {
        const itens = Object.values(agrupados[cat]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        const totalCategoria = itens.reduce((acc, item) => acc + item.qtd, 0);
        t += `*${cat}* (${totalCategoria} itens)\n`;
        itens.forEach(item => {
            const precoInfo = item.preco ? ` (R$ ${formatarValorComCentavos(item.preco)} cada)` : '';
            const totalInfo = item.total ? ` = R$ ${formatarValorComCentavos(item.total)}` : '';
            t += `- ${item.qtd} un. - ${item.nome}${precoInfo}${totalInfo}\n`;
        });
        t += `\n`;
    });

    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank');
    document.getElementById('resumos-modal').style.display = 'none';
}


window.abrirModalWhatsApp = function(id) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === id); if (!p) return; window.pedidoWhatsAppAtual = id;
    const n = (p.Nome_Cliente || 'Cliente').trim().split(' ')[0];
    document.getElementById('whatsapp-confirm-title').textContent = `Contato com ${n}`;
    document.getElementById('whatsapp-confirm-message').innerHTML = `<div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;"><button class="btn btn-primary" onclick="window.confirmarEnvioWhatsApp('resumo')" style="width: 100%; justify-content:center;">Enviar resumo</button><button class="btn btn-secondary" onclick="window.confirmarEnvioWhatsApp('contato')" style="width: 100%; justify-content:center;">Entrar em contato</button><button class="btn btn-outline" onclick="window.confirmarEnvioWhatsApp('pronto')" style="width: 100%; border-color:#28a745; color:#28a745; justify-content:center;">Pedido Pronto</button></div>`;
    document.getElementById('whatsapp-confirm-modal').style.display = 'flex';
}

window.confirmarEnvioWhatsApp = async function(m) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === window.pedidoWhatsAppAtual); if (!p) return;
    let num = p.Numero ? p.Numero.replace(/\D/g, '') : ''; if(num.length >= 10 && !num.startsWith('55')) num = '55' + num;
    const n = (p.Nome_Cliente || 'Cliente').trim().split(' ')[0]; let t = '';
    if (m === 'resumo') { t = `*Olá ${n}!*\n\n*Resumo do Pedido ${p.ID_do_Pedido}*\n\n*Data de Entrega:* ${p.Data_Entrega || '--/--/----'}\n*Horário:* ${p.Horario_Entrega || '--:--'}\n\n${p.Resumo_dos_Itens ? `*Itens:*\n${p.Resumo_dos_Itens}\n\n` : ''}*Total:* R$ ${formatarValorComCentavos(p.Total_Final)}\n*Forma de Pagamento:* ${p.Forma_de_Pagamento || 'Não informado'}`; } 
    else if (m === 'pronto') { window.mostrarLoading(true); try { await updateDoc(doc(db, "pedidos", p.ID_do_Pedido), { Status_do_Pedido: 'Retirada' }); } catch(e) {} window.mostrarLoading(false); t = `*Olá ${n}!*\n\nSeu pedido *${p.ID_do_Pedido}* está pronto para retirada!\n\n${p.Data_Entrega || '--/--/----'}\n${p.Horario_Entrega || '--:--'}\n\nAguardamos você!`; } 
    else { t = `Olá ${n}!`; }
    if(num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(t)}`, '_blank'); document.getElementById('whatsapp-confirm-modal').style.display = 'none';
}

window.openDatePicker = function() {
    const displayManual = document.getElementById('date-filter-display')?.value || '';
    if (displayManual) sincronizarFiltroDataOcultoPeloDisplay(displayManual, false);
    const dF = document.getElementById('date-input').value;
    if (dF) { if (dF.includes(',')) { const [di, dFim] = dF.split(','); window.dataInicialIntervalo = new Date(parseInt(di.split('-')[0]), parseInt(di.split('-')[1]) - 1, parseInt(di.split('-')[2]), 0,0,0,0); window.dataFinalIntervalo = new Date(parseInt(dFim.split('-')[0]), parseInt(dFim.split('-')[1]) - 1, parseInt(dFim.split('-')[2]), 0,0,0,0); } else { window.dataInicialIntervalo = new Date(parseInt(dF.split('-')[0]), parseInt(dF.split('-')[1]) - 1, parseInt(dF.split('-')[2]), 0,0,0,0); window.dataFinalIntervalo = null; } } else { window.dataInicialIntervalo = null; window.dataFinalIntervalo = null; }
    document.getElementById('date-picker-modal').style.display = 'flex'; window.renderCalendar();
}
window.closeDatePicker = function() { document.getElementById('date-picker-modal').style.display = 'none'; }
window.renderCalendar = function() {
    const cg = document.getElementById('calendar-grid'); if(!cg) return;
    const y = window.currentCalendarDate.getFullYear(), m = window.currentCalendarDate.getMonth();
    document.getElementById('month-year-display').textContent = `${['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][m]} ${y}`;
    cg.innerHTML = ''; ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(d => cg.innerHTML += `<div class="date-picker-weekday">${d}</div>`);
    const fD = new Date(y, m, 1).getDay(), dM = new Date(y, m + 1, 0).getDate();
    for(let i=0; i<fD; i++) cg.innerHTML += `<div class="date-picker-empty"></div>`;
    for(let d=1; d<=dM; d++) {
        const cD = new Date(y, m, d, 0,0,0,0), el = document.createElement('div'); el.className = 'date-picker-day'; el.textContent = d; el.onclick = (e) => { e.stopPropagation(); window.selecionarData(y, m, d); };
        if (cD.getTime() === new Date(new Date().setHours(0,0,0,0)).getTime()) el.classList.add('today');
        if (window.dataInicialIntervalo && window.dataFinalIntervalo) { if (cD.getTime() === window.dataInicialIntervalo.getTime()) el.classList.add('range-start'); else if (cD.getTime() === window.dataFinalIntervalo.getTime()) el.classList.add('range-end'); else if (cD >= window.dataInicialIntervalo && cD <= window.dataFinalIntervalo) el.classList.add('in-range'); } else if (window.dataInicialIntervalo && cD.getTime() === window.dataInicialIntervalo.getTime()) el.classList.add('selected');
        cg.appendChild(el);
    }
}
window.selecionarData = function(y, m, d) {
    const sD = new Date(y, m, d, 0,0,0,0);
    
    if (window.dataInicialIntervalo && window.dataFinalIntervalo) { 
        window.dataInicialIntervalo = sD; 
        window.dataFinalIntervalo = null; 
    } else if (!window.dataInicialIntervalo) { 
        window.dataInicialIntervalo = sD; 
        window.dataFinalIntervalo = null; 
    } else if (!window.dataFinalIntervalo) { 
        if (sD < window.dataInicialIntervalo) { 
            window.dataFinalIntervalo = new Date(window.dataInicialIntervalo); 
            window.dataInicialIntervalo = sD; 
        } else { 
            window.dataFinalIntervalo = sD; 
        } 
    }
    
    window.atualizarDisplayData(); 
    window.renderCalendar();
    
    // Dispara a filtragem automaticamente assim que o intervalo de duas datas for concluído
    if (window.dataInicialIntervalo && window.dataFinalIntervalo) {
        window.filtrarPedidos();
        window.closeDatePicker();
    }
}
window.atualizarDisplayData = function() {
    if (window.dataInicialIntervalo && window.dataFinalIntervalo) {
        document.getElementById('date-filter-display').value = `${String(window.dataInicialIntervalo.getDate()).padStart(2, '0')}/${String(window.dataInicialIntervalo.getMonth() + 1).padStart(2, '0')}/${window.dataInicialIntervalo.getFullYear()} - ${String(window.dataFinalIntervalo.getDate()).padStart(2, '0')}/${String(window.dataFinalIntervalo.getMonth() + 1).padStart(2, '0')}/${window.dataFinalIntervalo.getFullYear()}`;
        document.getElementById('date-input').value = `${window.dataInicialIntervalo.getFullYear()}-${String(window.dataInicialIntervalo.getMonth() + 1).padStart(2, '0')}-${String(window.dataInicialIntervalo.getDate()).padStart(2, '0')},${window.dataFinalIntervalo.getFullYear()}-${String(window.dataFinalIntervalo.getMonth() + 1).padStart(2, '0')}-${String(window.dataFinalIntervalo.getDate()).padStart(2, '0')}`;
    } else if (window.dataInicialIntervalo) {
        document.getElementById('date-filter-display').value = `${String(window.dataInicialIntervalo.getDate()).padStart(2, '0')}/${String(window.dataInicialIntervalo.getMonth() + 1).padStart(2, '0')}/${window.dataInicialIntervalo.getFullYear()}`;
        document.getElementById('date-input').value = `${window.dataInicialIntervalo.getFullYear()}-${String(window.dataInicialIntervalo.getMonth() + 1).padStart(2, '0')}-${String(window.dataInicialIntervalo.getDate()).padStart(2, '0')}`;
    } else { document.getElementById('date-filter-display').value = ''; document.getElementById('date-input').value = ''; }
}
window.aplicarFiltroData = function() { if (!window.dataInicialIntervalo) return window.showToast("Selecione uma data!", true); if (window.dataInicialIntervalo && !window.dataFinalIntervalo) window.dataFinalIntervalo = new Date(window.dataInicialIntervalo); window.atualizarDisplayData(); window.filtrarPedidos(); window.closeDatePicker(); }
window.filtrarEstaSemana = function() { 
    let hoje = new Date(); hoje.setHours(0,0,0,0); 
    let diaSemana = hoje.getDay(); 
    let diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1); 
    let segunda = new Date(hoje); segunda.setDate(diff); 
    let domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6); 
    window.dataInicialIntervalo = segunda; window.dataFinalIntervalo = domingo; 
    window.atualizarDisplayData(); window.renderCalendar(); window.aplicarFiltroData(); 
};

window.filtrarProximaSemana = function() { 
    let hoje = new Date(); hoje.setHours(0,0,0,0); 
    let diaSemana = hoje.getDay(); 
    let diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1) + 7; 
    let segunda = new Date(hoje); segunda.setDate(diff); 
    let domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6); 
    window.dataInicialIntervalo = segunda; window.dataFinalIntervalo = domingo; 
    window.atualizarDisplayData(); window.renderCalendar(); window.aplicarFiltroData(); 
};

window.filtrarEsteMes = function() { 
    const hj = new Date(), mA = hj.getMonth(), aA = hj.getFullYear(); 
    window.dataInicialIntervalo = new Date(aA, mA, 1, 0,0,0,0); 
    window.dataFinalIntervalo = new Date(aA, mA + 1, 0, 0,0,0,0); 
    window.atualizarDisplayData(); window.renderCalendar(); window.aplicarFiltroData(); 
};

window.filtrarProximoMes = function() {
    const hj = new Date(), mA = hj.getMonth() + 1, aA = hj.getFullYear();
    window.dataInicialIntervalo = new Date(aA, mA, 1, 0,0,0,0);
    window.dataFinalIntervalo = new Date(aA, mA + 1, 0, 0,0,0,0);
    window.atualizarDisplayData(); window.renderCalendar(); window.aplicarFiltroData();
};

window.filtrarMesAnterior = function() {
    const hj = new Date(), mA = hj.getMonth() - 1, aA = hj.getFullYear();
    window.dataInicialIntervalo = new Date(aA, mA, 1, 0,0,0,0);
    window.dataFinalIntervalo = new Date(aA, mA + 1, 0, 0,0,0,0);
    window.atualizarDisplayData(); window.renderCalendar(); window.aplicarFiltroData();
};

// === GASTOS 2026-08: popup de filtro de PERÍODO (intervalo de datas real, no mesmo
// fluxo/formato do filtro de Data de Entrega de Pedidos: "01/07/2026 - 08/07/2026").
// Este filtro só é usado/visível na sub-aba "Lançamentos". A grade "Gastos Cadastrados"
// (Jan-Dez) continua funcionando por ano cheio, via os selects ocultos #gastos-mes-filtro/
// #gastos-ano, que ficam sincronizados com o início do período escolhido aqui.
window.gastosCalendarDate = new Date();
window.gastosDataInicial = null;
window.gastosDataFinal = null;

window.garantirOpcaoAnoGastos = function(ano) {
    const select = document.getElementById('gastos-ano');
    if (!select) return;
    const existe = [...select.options].some(o => Number(o.value) === Number(ano));
    if (!existe) {
        const opt = document.createElement('option');
        opt.value = String(ano);
        opt.textContent = `Ano: ${ano}`;
        select.appendChild(opt);
    }
};

// Mantém #gastos-mes-filtro/#gastos-ano (usados só pela grade "Gastos Cadastrados",
// que mostra o ano inteiro) alinhados com o início do período escolhido em Lançamentos.
window.sincronizarMesAnoGastosComPeriodo = function() {
    if (!window.gastosDataInicial) return;
    window.garantirOpcaoAnoGastos(window.gastosDataInicial.getFullYear());
    const selMes = document.getElementById('gastos-mes-filtro');
    const selAno = document.getElementById('gastos-ano');
    if (selMes) selMes.value = String(window.gastosDataInicial.getMonth() + 1);
    if (selAno) selAno.value = String(window.gastosDataInicial.getFullYear());
};

window.atualizarDisplayDataGastos = function() {
    const display = document.getElementById('gastos-date-filter-display');
    if (!display) return;
    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    if (window.gastosDataInicial && window.gastosDataFinal) {
        display.value = `${fmt(window.gastosDataInicial)} - ${fmt(window.gastosDataFinal)}`;
    } else if (window.gastosDataInicial) {
        display.value = fmt(window.gastosDataInicial);
    } else {
        display.value = '';
    }
};

window.aplicarFiltroPeriodoGastos = function() {
    if (!window.gastosDataInicial) return;
    if (!window.gastosDataFinal) window.gastosDataFinal = new Date(window.gastosDataInicial);
    window.atualizarDisplayDataGastos();
    window.closeGastosDatePicker();
    window.renderGastosPlanilha();
};

window.openGastosDatePicker = function() {
    window.gastosCalendarDate = window.gastosDataInicial
        ? new Date(window.gastosDataInicial.getFullYear(), window.gastosDataInicial.getMonth(), 1)
        : new Date();
    document.getElementById('gastos-date-picker-modal').style.display = 'flex';
    window.renderGastosCalendarPopup();
};

window.closeGastosDatePicker = function() {
    document.getElementById('gastos-date-picker-modal').style.display = 'none';
};

window.mudarMesGastosCalendar = function(delta) {
    window.gastosCalendarDate.setMonth(window.gastosCalendarDate.getMonth() + delta);
    window.renderGastosCalendarPopup();
};

window.renderGastosCalendarPopup = function() {
    const cg = document.getElementById('gastos-calendar-grid');
    if (!cg) return;
    const y = window.gastosCalendarDate.getFullYear(), m = window.gastosCalendarDate.getMonth();
    const nomesCompletos = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const displayEl = document.getElementById('gastos-month-year-display');
    if (displayEl) displayEl.textContent = `${nomesCompletos[m]} ${y}`;

    const hoje = new Date(); hoje.setHours(0,0,0,0);

    cg.innerHTML = '';
    ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(d => cg.innerHTML += `<div class="date-picker-weekday">${d}</div>`);
    const fD = new Date(y, m, 1).getDay(), dM = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < fD; i++) cg.innerHTML += `<div class="date-picker-empty"></div>`;
    for (let d = 1; d <= dM; d++) {
        const cD = new Date(y, m, d, 0, 0, 0, 0);
        const el = document.createElement('div');
        el.className = 'date-picker-day';
        el.textContent = d;
        el.onclick = (e) => { e.stopPropagation(); window.selecionarDataGastos(y, m, d); };
        if (cD.getTime() === hoje.getTime()) el.classList.add('today');
        if (window.gastosDataInicial && window.gastosDataFinal) {
            if (cD.getTime() === window.gastosDataInicial.getTime()) el.classList.add('range-start');
            else if (cD.getTime() === window.gastosDataFinal.getTime()) el.classList.add('range-end');
            else if (cD >= window.gastosDataInicial && cD <= window.gastosDataFinal) el.classList.add('in-range');
        } else if (window.gastosDataInicial && cD.getTime() === window.gastosDataInicial.getTime()) {
            el.classList.add('selected');
        }
        cg.appendChild(el);
    }
};

// Seleção em 2 cliques (início/fim), igual ao calendário de Data de Entrega de Pedidos.
window.selecionarDataGastos = function(y, m, d) {
    const sD = new Date(y, m, d, 0, 0, 0, 0);

    if (window.gastosDataInicial && window.gastosDataFinal) {
        window.gastosDataInicial = sD;
        window.gastosDataFinal = null;
    } else if (!window.gastosDataInicial) {
        window.gastosDataInicial = sD;
        window.gastosDataFinal = null;
    } else if (!window.gastosDataFinal) {
        if (sD < window.gastosDataInicial) {
            window.gastosDataFinal = new Date(window.gastosDataInicial);
            window.gastosDataInicial = sD;
        } else {
            window.gastosDataFinal = sD;
        }
    }

    window.atualizarDisplayDataGastos();
    window.renderGastosCalendarPopup();

    if (window.gastosDataInicial && window.gastosDataFinal) {
        window.aplicarFiltroPeriodoGastos();
    }
};

window.gastosFiltrarEsteMes = function() {
    const hj = new Date();
    window.gastosDataInicial = new Date(hj.getFullYear(), hj.getMonth(), 1, 0,0,0,0);
    window.gastosDataFinal = new Date(hj.getFullYear(), hj.getMonth() + 1, 0, 0,0,0,0);
    window.aplicarFiltroPeriodoGastos();
};

window.gastosFiltrarMesAnterior = function() {
    const hj = new Date();
    const ref = new Date(hj.getFullYear(), hj.getMonth() - 1, 1);
    window.gastosDataInicial = new Date(ref.getFullYear(), ref.getMonth(), 1, 0,0,0,0);
    window.gastosDataFinal = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 0,0,0,0);
    window.aplicarFiltroPeriodoGastos();
};

window.gastosFiltrarEstaSemana = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const diaSemana = hoje.getDay();
    const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    const segunda = new Date(hoje); segunda.setDate(diff);
    const domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6);
    window.gastosDataInicial = segunda; window.gastosDataFinal = domingo;
    window.aplicarFiltroPeriodoGastos();
};

window.gastosFiltrarSemanaPassada = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const diaSemana = hoje.getDay();
    const diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1) - 7;
    const segunda = new Date(hoje); segunda.setDate(diff);
    const domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6);
    window.gastosDataInicial = segunda; window.gastosDataFinal = domingo;
    window.aplicarFiltroPeriodoGastos();
};

// Inicializa o período padrão (mês atual) já no carregamento, pra Lançamentos/Exportar
// mostrarem algo sensato antes de qualquer interação do usuário com o filtro.
(function inicializarPeriodoGastosPadrao() {
    const hj = new Date();
    window.gastosDataInicial = new Date(hj.getFullYear(), hj.getMonth(), 1, 0,0,0,0);
    window.gastosDataFinal = new Date(hj.getFullYear(), hj.getMonth() + 1, 0, 0,0,0,0);
})();

window.limparFiltros = function() { document.getElementById('search-input-pedidos').value = ''; document.getElementById('date-input').value = ''; document.getElementById('date-filter-display').value = ''; document.getElementById('filter-status-pagamento').value = ''; document.getElementById('filter-forma-pagamento').value = ''; document.getElementById('filter-observacao').value = ''; window.dataInicialIntervalo = null; window.dataFinalIntervalo = null; window.filtrarPedidos(); }
window.mudarMes = function(delta) { window.currentCalendarDate.setMonth(window.currentCalendarDate.getMonth() + delta); window.renderCalendar(); }
window.fecharModalPedido = function(id) { document.getElementById(id).style.display = 'none'; }
window.mostrarLoading = function(show) { document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none'; }
window.showToast = function(msg, isError = false) { const t = document.getElementById('toast'); t.textContent = msg; t.style.backgroundColor = isError ? '#e74c3c' : '#28a745'; t.style.display = 'block'; setTimeout(() => { t.style.display = 'none'; }, 3000); }

// ==========================================
// MÓDULO DE ESTOQUE
// ==========================================
document.getElementById('search-estoque')?.addEventListener('input', () => { window.renderEstoqueTable(); });

async function loadEstoque() {
    const s = await getDocs(collection(db, "estoque"));
    allEstoque = [];
    s.forEach(d => allEstoque.push({id: d.id, ...d.data()}));
    window.renderEstoqueTable();
    window.checarAlertasEstoque();
}

window.renderEstoqueTable = function() {
    const tb = document.querySelector("#tbl-estoque tbody");
    if (!tb) return;
    tb.innerHTML = "";
    
    const searchInput = document.getElementById('search-estoque');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    let filtered = allEstoque.filter(e => `${e.nome} ${e.unidade}`.toLowerCase().includes(searchTerm));

    filtered.sort((a, b) => window.sortAlfabetico(a.nome, b.nome)).forEach(e => {
        const isBaixo = parseFloat(e.quantidadeAtual) <= parseFloat(e.quantidadeMinima);
        
        tb.innerHTML += `<tr>
            <td data-label="Insumo:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${e.nome}</strong></td>
            <td data-label="Unidade:">${e.unidade}</td>
            <td data-label="Atual:"><strong style="color: ${isBaixo ? '#E60000' : 'var(--favu-moss)'};">${e.quantidadeAtual}</strong></td>
            <td data-label="Mínimo:">${e.quantidadeMinima}</td>
            <td data-label="Status:"><span class="badge ${isBaixo ? 'inativo' : 'ativo'}">${isBaixo ? 'Baixo / Faltando' : 'Suficiente'}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditEstoque('${e.id}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action del" onclick="window.delEstoque('${e.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

window.checarAlertasEstoque = function() {
    const alertaDiv = document.getElementById('alertas-estoque');
    const listaFaltas = document.getElementById('lista-faltas-estoque');
    if (!alertaDiv || !listaFaltas) return;

    listaFaltas.innerHTML = '';
    let temAlerta = false;

    allEstoque.forEach(e => {
        if (parseFloat(e.quantidadeAtual) <= parseFloat(e.quantidadeMinima)) {
            temAlerta = true;
            listaFaltas.innerHTML += `<li><strong>${e.nome}:</strong> Restam apenas ${e.quantidadeAtual} ${e.unidade} (Mínimo: ${e.quantidadeMinima})</li>`;
        }
    });

    alertaDiv.style.display = temAlerta ? 'block' : 'none';
}

const formAddEstoque = document.getElementById('form-add-estoque');
if (formAddEstoque) {
    formAddEstoque.onsubmit = async(e) => {
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]'); 
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
        try {
            await addDoc(collection(db, "estoque"), {
                nome: document.getElementById('ae-nome').value.trim(),
                unidade: document.getElementById('ae-unidade').value,
                quantidadeAtual: parseFloat(document.getElementById('ae-atual').value) || 0,
                quantidadeMinima: parseFloat(document.getElementById('ae-minimo').value) || 0,
                custo_medio_por_unidade: 0
            });
            customAlert("Insumo Adicionado!");
            window.closeModal('modal-add-estoque', 'form-add-estoque');
            loadEstoque();
        } catch(err) { 
            customAlert("Erro ao salvar.", "Erro"); 
        } finally { 
            btn.innerHTML = 'Salvar Insumo'; btn.disabled = false; 
        }
    };
}

window.openEditEstoque = async(id) => {
    const e = (await getDoc(doc(db,"estoque", id))).data();
    document.getElementById('ee-id').value = id;
    document.getElementById('ee-nome').value = e.nome;
    document.getElementById('ee-unidade').value = e.unidade;
    document.getElementById('ee-atual').value = e.quantidadeAtual;
    document.getElementById('ee-minimo').value = e.quantidadeMinima;
    window.openModal('modal-edit-estoque');
};

const formEditEstoque = document.getElementById('form-edit-estoque');
if (formEditEstoque) {
    formEditEstoque.onsubmit = async(e) => {
        e.preventDefault(); 
        const btn = e.target.querySelector('button[type="submit"]'); 
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
        try {
            await updateDoc(doc(db, "estoque", document.getElementById('ee-id').value), {
                nome: document.getElementById('ee-nome').value.trim(),
                unidade: document.getElementById('ee-unidade').value,
                quantidadeAtual: parseFloat(document.getElementById('ee-atual').value) || 0,
                quantidadeMinima: parseFloat(document.getElementById('ee-minimo').value) || 0,
            });
            customAlert("Insumo Atualizado!");
            window.closeModal('modal-edit-estoque', 'form-edit-estoque');
            loadEstoque();
        } catch(err) { 
            customAlert("Erro.", "Erro"); 
        } finally { 
            btn.innerHTML = 'Atualizar'; btn.disabled = false; 
        }
    };
}

window.delEstoque = async(id) => {
    customConfirm("Excluir este insumo permanentemente?", async () => {
        await deleteDoc(doc(db, "estoque", id));
        loadEstoque();
    });
};

window.registrarCompra = async function(insumoId, marca, quantidadeComprada, unidadeMedida, valorTotal) {
    try {
        let qtdConvertida = parseFloat(quantidadeComprada);
        if (unidadeMedida === 'Kg' || unidadeMedida === 'L') {
            qtdConvertida = qtdConvertida * 1000;
        }

        const custoDessaCompraPorBase = valorTotal / qtdConvertida;
        const insumoRef = doc(db, "estoque", insumoId);
        const insumoSnap = await getDoc(insumoRef);
        
        if (!insumoSnap.exists()) {
            customAlert("Insumo não encontrado no banco de dados.", "Erro");
            return;
        }
        
        const insumo = insumoSnap.data();
        const estoqueAntigo = parseFloat(insumo.quantidadeAtual) || 0;
        const custoMedioAntigo = parseFloat(insumo.custo_medio_por_unidade) || 0;
        const valorEmEstoque = estoqueAntigo * custoMedioAntigo;
        const estoqueNovoTotal = estoqueAntigo + qtdConvertida;
        const novoCustoMedio = (valorEmEstoque + valorTotal) / estoqueNovoTotal;

        await updateDoc(insumoRef, {
            quantidadeAtual: estoqueNovoTotal,
            custo_medio_por_unidade: novoCustoMedio
        });

        await addDoc(collection(db, "historico_compras"), {
            insumo_id: insumoId,
            marca: marca,
            data: Date.now(), 
            qtd_convertida: qtdConvertida,
            valor_total: valorTotal,
            unidade_compra: unidadeMedida,
            quantidade_comprada: quantidadeComprada
        });

        customAlert("Compra lançada e custo médio atualizado com sucesso!");
        loadEstoque(); 
    } catch (error) {
        console.error("Erro ao processar a compra: ", error);
        customAlert("Houve um erro ao registrar a compra.", "Erro");
    }
}

window.calcularCustoProduto = async function(produtoId, precoVendaProduto) {
    try {
        const fichaRef = doc(db, "fichas_tecnicas", produtoId);
        const fichaSnap = await getDoc(fichaRef);
        
        if(!fichaSnap.exists()) return null;
        
        const ficha = fichaSnap.data();
        let custoTotalReceita = 0;

        if (ficha.ingredientes && Array.isArray(ficha.ingredientes)) {
            for (let ingrediente of ficha.ingredientes) {
                const insumoSnap = await getDoc(doc(db, "estoque", ingrediente.insumo_id));
                if (insumoSnap.exists()) {
                    const insumo = insumoSnap.data();
                    const custoInsumoPorUnidade = parseFloat(insumo.custo_medio_por_unidade) || 0;
                    custoTotalReceita += (parseFloat(ingrediente.qtd_usada) * custoInsumoPorUnidade);
                }
            }
        }

        const rendimento = parseFloat(ficha.rendimento) || 1;
        const custoPorUnidade = custoTotalReceita / rendimento;
        const lucroBruto = precoVendaProduto - custoPorUnidade;
        const margemLucro = (lucroBruto / precoVendaProduto) * 100;

        return {
            custoPorUnidade: custoPorUnidade,
            lucroReais: lucroBruto,
            margem: margemLucro.toFixed(2) + '%'
        };
    } catch (error) {
        console.error("Erro ao calcular a Ficha Técnica: ", error);
        return null;
    }
}

document.addEventListener("DOMContentLoaded", () => { let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { window.configurarAcordeaoColunas(); if (window.innerWidth > 768) document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('expanded')); }, 250); }); });

// ==========================================
// APLICAR DESCONTO NA EDIÇÃO
// ==========================================
window.aplicarDescontoEdit = function() {
    const descInput = document.getElementById('edit-desconto-pedido');
    const desc = parseFloat(descInput.value.replace(',', '.')) || 0;
    
    if (desc <= 0) return window.showToast('Insira um valor maior que zero.', true);
    
    // Pega o valor total atual e deduz o desconto
    const totalElement = document.getElementById('edit-total-pedido');
    let totalAtual = parseFloat(totalElement.value.replace(/\./g, '').replace(',', '.')) || 0;
    
    totalAtual -= desc;
    if(totalAtual < 0) totalAtual = 0;
    totalElement.value = totalAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    
    // Adiciona o histórico do desconto no campo de Cupom para controle
    const cupomElement = document.getElementById('edit-cupom-pedido');
    const descText = `Desconto Extra (R$ ${desc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`;
    cupomElement.value = cupomElement.value ? cupomElement.value + ` | ${descText}` : descText;
    
    // Limpa o campo de desconto e avisa
    descInput.value = '';
    window.showToast('Desconto abatido do Total Final!');
};

// ==========================================
// MÓDULO DE AGENDA DE HORÁRIOS (DATAS RESTRITAS)
// ==========================================

// --- INÍCIO DA REGRA GERAL ---
window.carregarConfigAgendaGeral = async function() {
    try {
        const docSnap = await getDoc(doc(db, 'config', 'agenda_geral'));
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Varre de 0 (Dom) a 6 (Sáb) para preencher a tela
            for (let i = 0; i <= 6; i++) {
                if (data[i]) {
                    document.getElementById(`dia-${i}-ativo`).checked = data[i].ativo || false;
                    document.getElementById(`dia-${i}-horas`).value = data[i].horarios || '';
                }
            }
        }
    } catch (error) {
        console.error("Erro ao carregar a regra geral:", error);
    }
};

window.salvarConfigAgendaGeral = async function() {
    window.mostrarLoading(true);
    try {
        let agendaDaSemana = {};
        
        // Varre de 0 a 6 para ler os valores da tela e montar o objeto
        for (let i = 0; i <= 6; i++) {
            agendaDaSemana[i] = {
                ativo: document.getElementById(`dia-${i}-ativo`).checked,
                horarios: document.getElementById(`dia-${i}-horas`).value.trim()
            };
        }

        // Salva o pacotão com os 7 dias de uma vez no Firebase
        await setDoc(doc(db, 'config', 'agenda_geral'), agendaDaSemana);
        
        window.showToast('Regra Geral salva com sucesso!');
    } catch (error) {
        window.showToast('Erro ao salvar configurações.', true);
    }
    window.mostrarLoading(false);
};
// --- FIM DA REGRA GERAL ---

window.allAgendas = [];

window.loadAgendas = async function() {
    const s = await getDocs(collection(db, "agenda_horarios"));
    window.allAgendas = [];
    s.forEach(d => window.allAgendas.push({ id: d.id, ...d.data() }));
    window.renderAgendasTable();
}

// Função para Salvar Edição Rápida
window.atualizarAgendaInline = async function(id, campo, valor) {
    try {
        await updateDoc(doc(db, "agenda_horarios", id), { [campo]: valor });
        window.showToast("Edição salva com sucesso!");
    } catch (e) {
        window.showToast("Erro ao editar.", true);
    }
};

// Motor de visualização de 30 em 30 min para o Admin
window.previewHorariosAdmin = function(texto) {
    if (!texto || texto.trim() === '') return [];
    const blocos = texto.split(',').map(b => b.trim());
    let resultado = [];
    function formata(min) { return `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`; }
    blocos.forEach(bloco => {
        const partes = bloco.split(/\s+(?:às|as|-)\s+/i);
        if (partes.length === 2) {
            let [i, f] = partes.map(p => { let m = p.replace(/[^0-9:]/g,'').split(':'); return (parseInt(m[0]||0)*60)+parseInt(m[1]||0); });
            for (let m = i; m <= f; m += 30) resultado.push(formata(m));
        } else {
            let m = bloco.replace(/[^0-9:]/g,'').split(':');
            if(m[0]) resultado.push(formata((parseInt(m[0])*60)+parseInt(m[1]||0)));
        }
    });
    return [...new Set(resultado)].sort();
};

window.renderAgendasTable = function() {
    const tb = document.querySelector('#tbl-horarios tbody');
    if(!tb) return;
    tb.innerHTML = '';
    
    const ordenadas = window.allAgendas.sort((a, b) => a.id.localeCompare(b.id));

    ordenadas.forEach(a => {
        const dataFormatada = a.id.split('-').reverse().join('/'); 
        let htmlEdicao = '';

        if (a.indisponivel) {
            const msgAtual = a.mensagem || '⛔ FECHADO (Bloqueado)';
            htmlEdicao = `<input type="text" value="${msgAtual}" onchange="window.atualizarAgendaInline('${a.id}', 'mensagem', this.value)" style="border: 1px dashed transparent; background: transparent; padding: 4px; border-radius: 4px; color: #E60000; font-weight: bold; width: 100%; transition: 0.2s;" placeholder="Digite o aviso para o cliente...">`;
        } else {
            // Se as horas estiverem em Array (código antigo) ou String (código novo), ele trata corretamente
            const hrsAtual = Array.isArray(a.horarios) ? a.horarios.join(', ') : (a.horarios || '');
            const previewGerado = window.previewHorariosAdmin(hrsAtual).join(', ');
            
            htmlEdicao = `
                <input type="text" value="${hrsAtual}" onchange="window.atualizarAgendaInline('${a.id}', 'horarios', this.value)" style="border: 1px dashed transparent; background: transparent; padding: 4px; border-radius: 4px; color: #333; font-weight: bold; width: 100%; transition: 0.2s;" placeholder="Ex: 8h às 12h, 15h às 20h">
                <div style="font-size: 0.75rem; color: #777; margin-top: 4px;">Horários
                : ${previewGerado || 'Nenhum'}</div>
            `;
        }

        tb.innerHTML += `<tr>
            <td data-label="Data Restrita:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${dataFormatada}</strong></td>
            <td data-label="Horários/Mensagem:">${htmlEdicao}</td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action del" onclick="window.delAgenda('${a.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

import { deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"; // Certifique-se de incluir o deleteField no topo do arquivo se não houver

// Salva ou atualiza uma data específica
// Alterna visualmente os campos dependendo se está fechado ou não
window.toggleExcecaoCampos = function() {
    const fechado = document.getElementById('exc-fechado').checked;
    document.getElementById('container-exc-horas').style.display = fechado ? 'none' : 'block';
    document.getElementById('container-exc-mensagem').style.display = fechado ? 'block' : 'none';
};

// Salva ou atualiza uma data específica
// Salva ou atualiza uma data específica do ZERO
window.salvarExcecaoData = async function() {
    const dataAlvo = document.getElementById('exc-data').value;
    const estaFechado = document.getElementById('exc-fechado').checked;
    const horariosTexto = document.getElementById('exc-horas').value.trim();
    const mensagemTexto = document.getElementById('exc-mensagem').value.trim();

    if (!dataAlvo) { window.showToast('Selecione uma data.', true); return; }

    window.mostrarLoading(true);
    try {
        const payload = {
            indisponivel: estaFechado,
            horarios: estaFechado ? "" : horariosTexto,
            mensagem: estaFechado ? mensagemTexto : ""
        };

        await setDoc(doc(db, 'config', 'agenda_excecoes'), { [dataAlvo]: payload }, { merge: true });
        window.showToast('Regra aplicada!');
        
        // Limpa tudo
        document.getElementById('exc-data').value = '';
        document.getElementById('exc-fechado').checked = false;
        document.getElementById('exc-horas').value = '';
        document.getElementById('exc-mensagem').value = '';
        document.getElementById('container-exc-horas').style.display = 'block';
        document.getElementById('container-exc-msg').style.display = 'none';
        
        window.carregarExcecoesLista();
    } catch (error) { window.showToast('Erro ao gravar.', true); }
    window.mostrarLoading(false);
};

// Nova Função Mágica: Salva a edição na hora que você digita na lista!
window.atualizarExcecaoInline = async function(dataString, campo, valor) {
    try {
        await setDoc(doc(db, 'config', 'agenda_excecoes'), {
            [dataString]: { [campo]: valor }
        }, { merge: true });
        window.showToast("Edição salva com sucesso!");
    } catch(e) { window.showToast("Erro ao editar.", true); }
};

// Carrega a lista transformando a exibição em campos de edição direta (Inline Editing)
window.carregarExcecoesLista = async function() {
    const container = document.getElementById('lista-excecoes-container');
    if (!container) return;
    
    try {
        const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
        container.innerHTML = '';
        
        if (docSnap.exists()) {
            const dados = docSnap.data();
            const datasOrdenadas = Object.keys(dados).sort();
            
            if (datasOrdenadas.length === 0) {
                container.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma data especial.</p>';
                return;
            }

            datasOrdenadas.forEach(dataString => {
                const regra = dados[dataString];
                const [ano, mes, dia] = dataString.split('-');
                const dataFormatada = `${dia}/${mes}/${ano}`;

                let htmlEdicao;
                if (regra.indisponivel) {
                    const msgAtual = regra.mensagem || '⛔ FECHADO (Bloqueado)';
                    htmlEdicao = `<div style="display:flex; flex-direction:column; flex:1;">
                                    <span style="color:var(--danger); font-size: 0.8rem; font-weight:bold; margin-bottom:2px;">Mensagem para o cliente:</span>
                                    <input type="text" value="${msgAtual}" onchange="window.atualizarExcecaoInline('${dataString}', 'mensagem', this.value)" style="border: 1px dashed transparent; background: transparent; padding: 4px; border-radius: 4px; color: var(--danger); font-weight: bold; width: 100%; transition: 0.2s;" onfocus="this.style.border='1px dashed #ccc'; this.style.background='#f9f9f9'" onblur="this.style.border='1px dashed transparent'; this.style.background='transparent'">
                                  </div>`;
                } else {
                    const hrsAtual = regra.horarios || '';
                    htmlEdicao = `<div style="display:flex; flex-direction:column; flex:1;">
                                    <span style="color:var(--favu-moss); font-size: 0.8rem; font-weight:bold; margin-bottom:2px;">Horários/Intervalos:</span>
                                    <input type="text" value="${hrsAtual}" onchange="window.atualizarExcecaoInline('${dataString}', 'horarios', this.value)" style="border: 1px dashed transparent; background: transparent; padding: 4px; border-radius: 4px; color: #333; font-weight: bold; width: 100%; transition: 0.2s;" onfocus="this.style.border='1px dashed #ccc'; this.style.background='#f9f9f9'" onblur="this.style.border='1px dashed transparent'; this.style.background='transparent'">
                                  </div>`;
                }

                container.innerHTML += `
                    <div style="display:flex; align-items:center; background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd; gap: 15px; margin-bottom: 8px;">
                        <div style="background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 6px;">
                            <strong>${dataFormatada}</strong>
                        </div>
                        ${htmlEdicao}
                        <button type="button" onclick="window.deletarExcecaoData('${dataString}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem; padding: 10px;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma data especial.</p>';
        }
    } catch (error) { console.error(error); }
};

window.deletarExcecaoData = async function(dataString) {
    if (!confirm(`Deseja remover a regra da data ${dataString}?`)) return;
    window.mostrarLoading(true);
    try {
        await updateDoc(doc(db, 'config', 'agenda_excecoes'), { [dataString]: deleteField() });
        window.carregarExcecoesLista();
    } catch (error) { window.showToast('Erro ao remover.', true); }
    window.mostrarLoading(false);
};

// Carrega as exceções salvas e monta o visual (AGORA COM BOTÃO DE EDITAR)
window.carregarExcecoesLista = async function() {
    const container = document.getElementById('lista-excecoes-container');
    if (!container) return;
    
    try {
        const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
        container.innerHTML = '';
        
        if (docSnap.exists()) {
            const dados = docSnap.data();
            const datasOrdenadas = Object.keys(dados).sort();
            
            if (datasOrdenadas.length === 0) {
                container.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma data especial configurada.</p>';
                return;
            }

            datasOrdenadas.forEach(dataString => {
                const regra = dados[dataString];
                const [ano, mes, dia] = dataString.split('-');
                const dataFormatadaVisivel = `${dia}/${mes}/${ano}`;

                // Se tiver mensagem, exibe. Se não tiver, exibe padrão.
                let textoRegra = regra.indisponivel 
                    ? `<span style="color:var(--danger); font-weight:bold;">⛔ FECHADO${regra.mensagem ? ` (${regra.mensagem})` : ''}</span>`
                    : `⏰ Horários: ${regra.horarios}`;

                container.innerHTML += `
                    <div style="display:flex; justify-content:between; align-items:center; background:#fff; padding:10px; border-radius:6px; border:1px solid #ddd; justify-content: space-between;">
                        <div>
                            <strong>${dataFormatadaVisivel}</strong> — ${textoRegra}
                        </div>
                        <div style="display:flex; gap:12px;">
                            <button type="button" title="Editar" onclick="window.editarExcecaoData('${dataString}')" style="background:none; border:none; color:var(--favu-rust); cursor:pointer; font-size:1.1rem;"><i class="fas fa-edit"></i></button>
                            <button type="button" title="Excluir" onclick="window.deletarExcecaoData('${dataString}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.1rem;"><i class="fas fa-trash-alt"></i></button>
                        </div>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma data especial configurada.</p>';
        }
    } catch (error) {
        console.error("Erro ao listar exceções:", error);
    }
};

// NOVA FUNÇÃO: Puxa a regra de volta para os campos para você editar
window.editarExcecaoData = async function(dataString) {
    try {
        const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
        if (docSnap.exists()) {
            const regra = docSnap.data()[dataString];
            if (regra) {
                document.getElementById('exc-data').value = dataString;
                document.getElementById('exc-fechado').checked = regra.indisponivel || false;
                document.getElementById('exc-horas').value = regra.horarios || '';
                
                // Preenche a mensagem caso exista (verificando compatibilidade com o HTML)
                const msgInput = document.getElementById('exc-mensagem');
                if(msgInput) msgInput.value = regra.mensagem || '';
                
                window.toggleExcecaoCampos();
                
                // Rola a tela suavemente para cima até o formulário
                document.getElementById('exc-data').scrollIntoView({behavior: "smooth", block: "center"});
                window.showToast("Edite os dados e clique em Adicionar Regra");
            }
        }
    } catch (error) {
        window.showToast('Erro ao carregar dados para edição.', true);
    }
};


window.copiarExcecaoData = async function(dataString) {
    let regra = window.cacheExcecoesAgenda?.[dataString];

    if (!regra) {
        try {
            const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
            window.cacheExcecoesAgenda = docSnap.exists() ? (docSnap.data() || {}) : {};
            regra = window.cacheExcecoesAgenda[dataString];
        } catch (error) {
            window.showToast('Erro ao copiar data específica.', true);
            return;
        }
    }

    if (!regra) return;

    const dataHidden = document.getElementById('edit-exc-data');
    const dataDisplay = document.getElementById('edit-exc-data-display');
    const fechado = document.getElementById('edit-exc-fechado');
    const horas = document.getElementById('edit-exc-horas');
    const msg = document.getElementById('edit-exc-mensagem');

    if (dataHidden) dataHidden.value = '';
    if (dataDisplay) dataDisplay.value = '';
    if (fechado) fechado.checked = !!regra.indisponivel;
    if (horas) horas.value = regra.horarios || '';
    if (msg) msg.value = regra.mensagem || '';

    window.toggleEditExcecaoCampos();
    window.openModal('modal-editar-excecao');
    window.showToast('Escolha uma nova data para salvar a cópia.');
};


// Apaga uma exceção criada
window.deletarExcecaoData = async function(dataString) {
    if (!confirm(`Deseja remover a regra especial da data ${dataString}?`)) return;
    
    window.mostrarLoading(true);
    try {
        const docRef = doc(db, 'config', 'agenda_excecoes');
        await updateDoc(docRef, {
            [dataString]: deleteField()
        });
        window.showToast('Regra removida com sucesso!');
        window.carregarExcecoesLista();
    } catch (error) {
        window.showToast('Erro ao remover regra.', true);
    }
    window.mostrarLoading(false);
};

// Carrega as exceções com a exibição da mensagem de aviso correta para o admin
window.carregarExcecoesLista = async function() {
    const container = document.getElementById('lista-excecoes-container');
    if (!container) return;
    
    try {
        const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
        container.innerHTML = '';
        
        if (docSnap.exists()) {
            const dados = docSnap.data();
            const datasOrdenadas = Object.keys(dados).sort();
            
            if (datasOrdenadas.length === 0) {
                container.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma data especial configurada.</p>';
                return;
            }

            datasOrdenadas.forEach(dataString => {
                const regra = dados[dataString];
                const [ano, mes, dia] = dataString.split('-');
                const dataFormatadaVisivel = `${dia}/${mes}/${ano}`;

                let htmlEdicao = '';
                if (regra.indisponivel) {
                    const msgAtual = regra.mensagem || '⛔ FECHADO (Bloqueado)';
                    htmlEdicao = `
                        <div style="display:flex; flex-direction:column; flex:1;">
                            <span style="color:var(--danger); font-size: 0.8rem; font-weight:bold; margin-bottom:2px;">Mensagem exibida no site:</span>
                            <input type="text" value="${msgAtual}" onchange="window.atualizarExcecaoInline('${dataString}', 'mensagem', this.value)" style="border: 1px dashed transparent; background: transparent; padding: 4px; border-radius: 4px; color: var(--danger); font-weight: bold; width: 100%; transition: 0.2s;" placeholder="Digite o aviso...">
                        </div>`;
                } else {
                    const hrsAtual = regra.horarios || '';
                    const previewGerado = window.previewHorariosAdmin ? window.previewHorariosAdmin(hrsAtual).join(', ') : '';
                    htmlEdicao = `
                        <div style="display:flex; flex-direction:column; flex:1;">
                            <span style="color:var(--favu-moss); font-size: 0.8rem; font-weight:bold; margin-bottom:2px;">Turnos/Horários:</span>
                            <input type="text" value="${hrsAtual}" onchange="window.atualizarExcecaoInline('${dataString}', 'horarios', this.value)" style="border: 1px dashed transparent; background: transparent; padding: 4px; border-radius: 4px; color: #333; font-weight: bold; width: 100%; transition: 0.2s;" placeholder="Ex: 8h às 12h, 15h às 20h">
                            <small style="color:#777; font-size:0.75rem; margin-top:3px;"><strong>Horários:</strong> ${previewGerado || 'Nenhum'}</small>
                        </div>`;
                }

                container.innerHTML += `
                    <div style="display:flex; align-items:center; background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd; gap: 15px; margin-bottom: 8px;">
                        <div style="background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 6px; white-space:nowrap;">
                            <strong>${dataFormatadaVisivel}</strong>
                        </div>
                        ${htmlEdicao}
                        <button type="button" onclick="window.deletarExcecaoData('${dataString}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1.2rem; padding: 10px;"><i class="fas fa-trash-alt"></i></button>
                    </div>
                `;
            });
        } else {
            container.innerHTML = '<p style="color:#888; font-size:0.9rem;">Nenhuma data especial configurada.</p>';
        }
    } catch (error) {
        console.error("Erro ao listar exceções:", error);
    }
};

// Apaga uma exceção criada
window.deletarExcecaoData = async function(dataString) {
    if (!confirm(`Deseja remover a regra especial da data ${dataString}?`)) return;
    
    window.mostrarLoading(true);
    try {
        const docRef = doc(db, 'config', 'agenda_excecoes');
        await updateDoc(docRef, {
            [dataString]: deleteField()
        });
        window.showToast('Regra removida com sucesso!');
        window.carregarExcecoesLista();
    } catch (error) {
        window.showToast('Erro ao remover regra.', true);
    }
    window.mostrarLoading(false);
};


// === HORÁRIOS 2026-06-19: datas específicas com filtro, popup e layout mobile ===
window.filtroExcecoesAtual = window.filtroExcecoesAtual || 'futuras';
window.cacheExcecoesAgenda = window.cacheExcecoesAgenda || {};

function escapeHtmlAgenda(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function dataHojeAgendaKey() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const y = hoje.getFullYear();
    const m = String(hoje.getMonth() + 1).padStart(2, '0');
    const d = String(hoje.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatarDataAgendaBR(dataString) {
    const [ano, mes, dia] = String(dataString || '').split('-');
    if (!ano || !mes || !dia) return dataString || '';
    return `${dia}/${mes}/${ano}`;
}

function resumoRegraAgenda(regra) {
    if (!regra) return '';
    if (regra.indisponivel) {
        return `Fechado${regra.mensagem ? ` — ${regra.mensagem}` : ''}`;
    }

    const horarios = regra.horarios || '';
    const preview = window.previewHorariosAdmin ? window.previewHorariosAdmin(horarios).join(', ') : '';
    return preview ? `Horários: ${preview}` : `Horários: ${horarios || 'Nenhum'}`;
}

window.toggleExcecaoCampos = function() {
    const fechado = document.getElementById('exc-fechado')?.checked;
    const horas = document.getElementById('container-exc-horas');
    const msg = document.getElementById('container-exc-msg') || document.getElementById('container-exc-mensagem');

    if (horas) horas.style.display = fechado ? 'none' : 'block';
    if (msg) msg.style.display = fechado ? 'block' : 'none';
};

window.toggleEditExcecaoCampos = function() {
    const fechado = document.getElementById('edit-exc-fechado')?.checked;
    const horas = document.getElementById('edit-container-exc-horas');
    const msg = document.getElementById('edit-container-exc-msg') || document.getElementById('edit-container-exc-mensagem');

    if (horas) horas.style.display = fechado ? 'none' : 'block';
    if (msg) msg.style.display = fechado ? 'block' : 'none';
};

window.setFiltroExcecoes = function(tipo) {
    window.filtroExcecoesAtual = tipo === 'passadas' ? 'passadas' : 'futuras';

    const btnFuturas = document.getElementById('tab-excecoes-futuras');
    const btnPassadas = document.getElementById('tab-excecoes-passadas');

    if (btnFuturas) btnFuturas.classList.toggle('active', window.filtroExcecoesAtual === 'futuras');
    if (btnPassadas) btnPassadas.classList.toggle('active', window.filtroExcecoesAtual === 'passadas');

    window.renderizarExcecoesAgendaLista();
};

window.renderizarExcecoesAgendaLista = function() {
    const container = document.getElementById('lista-excecoes-container');
    if (!container) return;

    const dados = window.cacheExcecoesAgenda || {};
    const hoje = dataHojeAgendaKey();

    let datas = Object.keys(dados).filter(dataString => {
        return window.filtroExcecoesAtual === 'passadas'
            ? dataString < hoje
            : dataString >= hoje;
    });

    datas.sort((a, b) => {
        return window.filtroExcecoesAtual === 'passadas'
            ? b.localeCompare(a)
            : a.localeCompare(b);
    });

    container.innerHTML = '';

    if (!datas.length) {
        container.innerHTML = `<p style="color:#888; font-size:0.9rem; font-family:var(--font-numbers);">${window.filtroExcecoesAtual === 'passadas' ? 'Nenhuma data passada.' : 'Nenhuma data específica vigente ou futura.'}</p>`;
        return;
    }

    datas.forEach(dataString => {
        const regra = dados[dataString] || {};
        const dataFormatada = formatarDataAgendaBR(dataString);
        const resumo = resumoRegraAgenda(regra);

        container.innerHTML += `
            <div class="excecao-card" onclick="window.editarExcecaoData('${dataString}')">
                <div class="excecao-card-main">
                    <strong class="excecao-card-data">${dataFormatada}</strong>
                    <div class="excecao-card-resumo">${escapeHtmlAgenda(resumo)}</div>
                </div>
                <div class="excecao-card-actions" onclick="event.stopPropagation();">
                    <button type="button" class="btn-action edit" title="Editar" aria-label="Editar" onclick="window.editarExcecaoData('${dataString}')"><i class="fas fa-pencil-alt"></i></button>
                    <button type="button" class="btn-action copy" title="Copiar" aria-label="Copiar" onclick="window.copiarExcecaoData('${dataString}')"><i class="fas fa-copy"></i></button>
                    <button type="button" class="btn-action del" title="Excluir" aria-label="Excluir" onclick="window.deletarExcecaoData('${dataString}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    });
};

window.carregarExcecoesLista = async function() {
    const container = document.getElementById('lista-excecoes-container');
    if (!container) return;

    try {
        const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
        window.cacheExcecoesAgenda = docSnap.exists() ? (docSnap.data() || {}) : {};
        window.renderizarExcecoesAgendaLista();
    } catch (error) {
        console.error("Erro ao listar exceções:", error);
        container.innerHTML = '<p style="color:#E60000; font-size:0.9rem; font-family:var(--font-numbers);">Erro ao carregar datas específicas.</p>';
    }
};

window.editarExcecaoData = async function(dataString) {
    let regra = window.cacheExcecoesAgenda?.[dataString];

    if (!regra) {
        try {
            const docSnap = await getDoc(doc(db, 'config', 'agenda_excecoes'));
            window.cacheExcecoesAgenda = docSnap.exists() ? (docSnap.data() || {}) : {};
            regra = window.cacheExcecoesAgenda[dataString];
        } catch (error) {
            window.showToast('Erro ao carregar data específica.', true);
            return;
        }
    }

    if (!regra) return;

    const dataHidden = document.getElementById('edit-exc-data');
    const dataDisplay = document.getElementById('edit-exc-data-display');
    const fechado = document.getElementById('edit-exc-fechado');
    const horas = document.getElementById('edit-exc-horas');
    const msg = document.getElementById('edit-exc-mensagem');

    if (dataHidden) dataHidden.value = dataString;
    if (dataDisplay) dataDisplay.value = dataString;
    if (fechado) fechado.checked = !!regra.indisponivel;
    if (horas) horas.value = regra.horarios || '';
    if (msg) msg.value = regra.mensagem || '';

    window.toggleEditExcecaoCampos();
    window.openModal('modal-editar-excecao');
};


window.abrirModalNovaDataEspecifica = function() {
    const form = document.getElementById('form-add-excecao');
    if (form) form.reset();

    const horas = document.getElementById('container-exc-horas');
    const msg = document.getElementById('container-exc-msg');
    if (horas) horas.style.display = 'block';
    if (msg) msg.style.display = 'none';

    window.openModal('modal-add-excecao');
};

window.salvarExcecaoData = async function() {
    const dataAlvo = document.getElementById('exc-data')?.value;
    const estaFechado = document.getElementById('exc-fechado')?.checked;
    const horariosTexto = document.getElementById('exc-horas')?.value.trim() || '';
    const mensagemTexto = document.getElementById('exc-mensagem')?.value.trim() || '';

    if (!dataAlvo) {
        window.showToast('Selecione uma data.', true);
        return;
    }

    window.mostrarLoading(true);
    try {
        const payload = {
            indisponivel: !!estaFechado,
            horarios: estaFechado ? "" : horariosTexto,
            mensagem: estaFechado ? mensagemTexto : ""
        };

        await setDoc(doc(db, 'config', 'agenda_excecoes'), { [dataAlvo]: payload }, { merge: true });
        window.showToast('Regra aplicada!');

        document.getElementById('exc-data').value = '';
        document.getElementById('exc-fechado').checked = false;
        document.getElementById('exc-horas').value = '';
        document.getElementById('exc-mensagem').value = '';
        window.toggleExcecaoCampos();

        await window.carregarExcecoesLista();
        window.closeModal('modal-add-excecao', 'form-add-excecao');
    } catch (error) {
        window.showToast('Erro ao gravar.', true);
    }
    window.mostrarLoading(false);
};

window.deletarExcecaoData = async function(dataString) {
    window.customConfirm(`Remover a data específica ${formatarDataAgendaBR(dataString)}?`, async () => {
        window.mostrarLoading(true);
        try {
            const docRef = doc(db, 'config', 'agenda_excecoes');
            await updateDoc(docRef, { [dataString]: deleteField() });
            window.showToast('Data específica removida!');
            await window.carregarExcecoesLista();
        } catch (error) {
            window.showToast('Erro ao remover data específica.', true);
        }
        window.mostrarLoading(false);
    });
};

const formEditExcecaoAgenda = document.getElementById('form-edit-excecao');
if (formEditExcecaoAgenda) {
    formEditExcecaoAgenda.onsubmit = async function(e) {
        e.preventDefault();

        const dataOriginal = document.getElementById('edit-exc-data')?.value || '';
        const dataAlvo = document.getElementById('edit-exc-data-display')?.value || '';
        const estaFechado = document.getElementById('edit-exc-fechado')?.checked;
        const horariosTexto = document.getElementById('edit-exc-horas')?.value.trim() || '';
        const mensagemTexto = document.getElementById('edit-exc-mensagem')?.value.trim() || '';

        if (!dataAlvo) {
            window.showToast('Informe a data específica.', true);
            return;
        }

        window.mostrarLoading(true);
        try {
            const payload = {
                indisponivel: !!estaFechado,
                horarios: estaFechado ? "" : horariosTexto,
                mensagem: estaFechado ? mensagemTexto : ""
            };

            const docRef = doc(db, 'config', 'agenda_excecoes');

            if (dataOriginal && dataOriginal !== dataAlvo) {
                await updateDoc(docRef, { [dataOriginal]: deleteField() });
            }

            await setDoc(docRef, { [dataAlvo]: payload }, { merge: true });
            window.closeModal('modal-editar-excecao', 'form-edit-excecao');
            window.showToast(dataOriginal && dataOriginal !== dataAlvo ? 'Data específica alterada!' : 'Data específica atualizada!');
            await window.carregarExcecoesLista();
        } catch (error) {
            console.error(error);
            window.showToast('Erro ao salvar data específica.', true);
        }
        window.mostrarLoading(false);
    };
}

document.getElementById('form-add-agenda').onsubmit = async(e) => {
    e.preventDefault();
    const dataRef = document.getElementById('ag-data').value; 
    const indisponivel = document.getElementById('ag-indisponivel').checked;
    // Agora salva o texto puro (ex: "8h às 12h, 15h às 20h") para o site do cliente processar!
    const horasTexto = indisponivel ? "" : document.getElementById('ag-horas').value.trim();

    await setDoc(doc(db, "agenda_horarios", dataRef), { indisponivel: indisponivel, horarios: horasTexto });
    customAlert("Regra de horários salva!");
    window.closeModal('modal-add-agenda', 'form-add-agenda');
    window.loadAgendas();
};

window.openEditAgenda = async(id) => {
    const a = window.allAgendas.find(x => x.id === id);
    if(!a) return;
    document.getElementById('e-ag-data').value = id;
    document.getElementById('e-ag-data-display').value = id;
    
    const indisponivel = a.indisponivel || false;
    document.getElementById('e-ag-indisponivel').checked = indisponivel;
    document.getElementById('e-ag-horas-container').style.display = indisponivel ? 'none' : 'block';
    document.getElementById('e-ag-horas').value = a.horarios ? a.horarios.join(', ') : '';
    
    window.openModal('modal-editar-agenda');
}

document.getElementById('form-edit-agenda').onsubmit = async(e) => {
    e.preventDefault();
    const dataRef = document.getElementById('e-ag-data').value;
    const indisponivel = document.getElementById('e-ag-indisponivel').checked;
    const horasTexto = indisponivel ? "" : document.getElementById('e-ag-horas').value.trim();

    await updateDoc(doc(db, "agenda_horarios", dataRef), { indisponivel: indisponivel, horarios: horasTexto });
    customAlert("Regra atualizada!");
    window.closeModal('modal-editar-agenda', 'form-edit-agenda');
    window.loadAgendas();
};

window.delAgenda = async(id) => {
    customConfirm(`Excluir as restrições da data ${id.split('-').reverse().join('/')}?`, async () => {
        await deleteDoc(doc(db, "agenda_horarios", id));
        window.loadAgendas();
    });
};

window.setFiltroSemanaAtualVisivel = function() {
    let hoje = new Date(); hoje.setHours(0,0,0,0);
    let diaSemana = hoje.getDay();
    let diff = hoje.getDate() - diaSemana + (diaSemana === 0 ? -6 : 1);
    
    window.dataInicialIntervalo = new Date(hoje);
    window.dataInicialIntervalo.setDate(diff);
    
    window.dataFinalIntervalo = new Date(window.dataInicialIntervalo);
    window.dataFinalIntervalo.setDate(window.dataInicialIntervalo.getDate() + 6);
    
    window.atualizarDisplayData(); // Mostra visualmente no campo
}


// ==========================================
// MÓDULO DE CUPONS
// ==========================================
window.allCupons = [];
window.filtroCuponsAtual = 'ativos';

window.setFiltroCupons = function(tipo) {
    window.filtroCuponsAtual = tipo === 'inativos' ? 'inativos' : 'ativos';
    document.getElementById('tab-cupons-ativos')?.classList.toggle('active', window.filtroCuponsAtual === 'ativos');
    document.getElementById('tab-cupons-inativos')?.classList.toggle('active', window.filtroCuponsAtual === 'inativos');
    window.renderCupons();
};

window.limparFiltroCupons = function() {
    const campo = document.getElementById('search-cupom');
    if (campo) campo.value = '';
    window.renderCupons();
};

function formatarDataCupomBR(dataString) {
    if (!dataString) return 'Sem validade';
    const d = String(dataString).split('T')[0];
    const partes = d.split('-');
    if (partes.length !== 3) return dataString;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function getStatusOperacionalCupom(cupom) {
    const status = String(cupom?.statusCupom || '').trim().toLowerCase();
    if (status === 'inativo' || status === 'pausado' || cupom?.ativo === false) return 'inativo';
    return 'ativo';
}

function isCupomFuncionando(cupom) {
    return getStatusOperacionalCupom(cupom) === 'ativo' && !isCupomVencido(cupom) && !isCupomEsgotado(cupom);
}

function getCupomStatusTexto(cupom) {
    const statusOperacional = getStatusOperacionalCupom(cupom);
    if (statusOperacional === 'inativo') return 'Inativo';
    if (isCupomVencido(cupom)) return 'Expirado';
    if (isCupomEsgotado(cupom)) return 'Esgotado';
    return 'Ativo';
}

function getCupomBadgeClasse(cupom) {
    const status = getCupomStatusTexto(cupom).toLowerCase();
    if (status === 'ativo') return 'ativo';
    if (status === 'pausado') return 'pausado';
    return 'inativo';
}

function formatarTipoValorCupom(cupom) {
    const valor = converterValorParaNumero(cupom?.valor || 0);
    if (cupom?.tipo === 'percentual') return `${formatarNumeroMoedaPedido(valor).replace(',00', '')}%`;
    return `R$ ${formatarNumeroMoedaPedido(valor)}`;
}

window.loadCupons = function() {
    const lista = document.getElementById('cupons-lista');
    if (!lista) return;

    onSnapshot(collection(db, "cupons"), snap => {
        window.allCupons = [];
        snap.forEach(docSnap => {
            window.allCupons.push({
                id: docSnap.id,
                codigo: docSnap.data().codigo || docSnap.id,
                ...docSnap.data()
            });
        });
        window.renderCupons();
    }, err => {
        console.error("Erro ao carregar cupons:", err);
        lista.innerHTML = '<p style="color:#E60000; font-family:var(--font-numbers);">Erro ao carregar cupons.</p>';
    });
};

window.renderCupons = function() {
    const lista = document.getElementById('cupons-lista');
    if (!lista) return;

    const termoBusca = (document.getElementById('search-cupom')?.value || '').trim().toLowerCase();
    const normalizarBusca = (valor) => String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const termoNormalizado = normalizarBusca(termoBusca);

    const filtrados = [...(window.allCupons || [])]
        .filter(cupom => window.filtroCuponsAtual === 'ativos' ? isCupomFuncionando(cupom) : !isCupomFuncionando(cupom))
        .filter(cupom => {
            if (!termoNormalizado) return true;
            return [
                cupom.codigo,
                cupom.id,
                getCupomStatusTexto(cupom),
                cupom.tipo,
                cupom.valor,
                cupom.valorMinimo,
                cupom.dataValidade
            ].some(valor => normalizarBusca(valor).includes(termoNormalizado));
        })
        .sort((a, b) => String(a.codigo || '').localeCompare(String(b.codigo || ''), 'pt-BR'));

    if (!filtrados.length) {
        lista.innerHTML = `<p style="color:#888; font-family:var(--font-numbers);">${window.filtroCuponsAtual === 'ativos' ? 'Nenhum cupom ativo encontrado.' : 'Nenhum cupom inativo encontrado.'}</p>`;
        return;
    }

    lista.innerHTML = filtrados.map(cupom => {
        const usos = getCupomUsosAtuais(cupom);
        const max = getCupomMaxUsos(cupom);
        const status = getCupomStatusTexto(cupom);
        const badgeClasse = getCupomBadgeClasse(cupom);
        const statusOperacional = getStatusOperacionalCupom(cupom);

        const acaoStatus = statusOperacional === 'ativo'
            ? `<button type="button" class="btn-action inactive" title="Inativar" onclick="window.definirStatusCupom('${cupom.id}', 'inativo')"><i class="fas fa-ban"></i></button>`
            : `<button type="button" class="btn-action activate" title="Ativar" onclick="window.definirStatusCupom('${cupom.id}', 'ativo')"><i class="fas fa-eye"></i></button>`;

        return `
            <div class="cupom-card">
                <div>
                    <div class="cupom-card-title">${escapeHtmlPedido(cupom.codigo || cupom.id)} <span class="cupom-badge ${badgeClasse}">${status}</span></div>
                    <div class="cupom-meta">
                        Uso: <strong>${usos}/${max || '∞'}</strong><br>
                        Validade: <strong>${formatarDataCupomBR(cupom.dataValidade)}</strong><br>
                        Desconto: <strong>${formatarTipoValorCupom(cupom)}</strong> • Pedido mínimo: <strong>R$ ${formatarNumeroMoedaPedido(cupom.valorMinimo || 0)}</strong>
                    </div>
                </div>
                <div class="cupom-card-actions">
                    <button type="button" class="btn-action edit" title="Editar" onclick="window.editarCupom('${cupom.id}')"><i class="fas fa-pen"></i></button>
                    <button type="button" class="btn-action copy" title="Copiar" onclick="window.copiarCupom('${cupom.id}')"><i class="fas fa-copy"></i></button>
                    ${acaoStatus}
                    <button type="button" class="btn-action del" title="Excluir" onclick="window.excluirCupom('${cupom.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');
};

window.limparFormCupom = function() {
    const form = document.getElementById('form-cupom');
    if (form) form.reset();
    const original = document.getElementById('cupom-id-original');
    if (original) original.value = '';
    const codigo = document.getElementById('cupom-codigo');
    if (codigo) codigo.disabled = false;
};

window.editarCupom = function(id) {
    const cupom = window.allCupons.find(c => c.id === id);
    if (!cupom) return;

    document.getElementById('edit-cupom-id-original').value = id;
    document.getElementById('edit-cupom-codigo').value = cupom.codigo || id;
    document.getElementById('edit-cupom-validade').value = String(cupom.dataValidade || '').split('T')[0];
    document.getElementById('edit-cupom-max-uso').value = getCupomMaxUsos(cupom) || '';
    document.getElementById('edit-cupom-tipo').value = cupom.tipo || 'fixo';
    document.getElementById('edit-cupom-valor').value = converterValorParaNumero(cupom.valor || 0);
    document.getElementById('edit-cupom-minimo').value = converterValorParaNumero(cupom.valorMinimo || 0);

    window.openModal('modal-editar-cupom');
};

window.copiarCupom = function(id) {
    const cupom = window.allCupons.find(c => c.id === id);
    if (!cupom) return;

    window.limparFormCupom();
    document.getElementById('cupom-codigo').value = `${cupom.codigo || id}_COPIA`;
    document.getElementById('cupom-validade').value = String(cupom.dataValidade || '').split('T')[0];
    document.getElementById('cupom-max-uso').value = getCupomMaxUsos(cupom) || '';
    document.getElementById('cupom-tipo').value = cupom.tipo || 'fixo';
    document.getElementById('cupom-valor').value = converterValorParaNumero(cupom.valor || 0);
    document.getElementById('cupom-minimo').value = converterValorParaNumero(cupom.valorMinimo || 0);
    document.getElementById('form-cupom')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.definirStatusCupom = async function(id, status) {
    const cupom = window.allCupons.find(c => c.id === id);
    if (!cupom) return;

    const statusFinal = ['ativo', 'inativo'].includes(status) ? status : 'ativo';
    await updateDoc(doc(db, "cupons", id), {
        ativo: statusFinal === 'ativo',
        statusCupom: statusFinal,
        updatedAt: Date.now()
    });

    const mensagens = { ativo: 'Cupom ativado!', inativo: 'Cupom inativado!' };
    window.showToast(mensagens[statusFinal] || 'Cupom atualizado!');
};

window.alternarCupom = async function(id) {
    const cupom = window.allCupons.find(c => c.id === id);
    if (!cupom) return;
    await window.definirStatusCupom(id, getStatusOperacionalCupom(cupom) === 'ativo' ? 'inativo' : 'ativo');
};

window.excluirCupom = function(id) {
    window.customConfirm(`Excluir o cupom ${id}?`, async () => {
        window.mostrarLoading(true);
        try {
            await deleteDoc(doc(db, "cupons", id));
            window.showToast('Cupom excluído!');
            window.limparFormCupom();
        } catch (err) {
            console.error(err);
            window.showToast('Erro ao excluir cupom.', true);
        }
        window.mostrarLoading(false);
    });
};


const formEditCupom = document.getElementById('form-edit-cupom');
if (formEditCupom) {
    formEditCupom.onsubmit = async function(e) {
        e.preventDefault();

        const original = document.getElementById('edit-cupom-id-original').value.trim().toUpperCase();
        const cupomExistente = original ? window.allCupons.find(c => c.id === original) : null;
        const maxUso = parseInt(document.getElementById('edit-cupom-max-uso').value, 10) || 0;
        const tipo = document.getElementById('edit-cupom-tipo').value;
        const valor = converterValorParaNumero(document.getElementById('edit-cupom-valor').value || 0);
        const valorMinimo = converterValorParaNumero(document.getElementById('edit-cupom-minimo').value || 0);
        const statusCupom = cupomExistente ? getStatusOperacionalCupom(cupomExistente) : 'ativo';
        const ativo = statusCupom === 'ativo';
        const usosAtuais = cupomExistente ? getCupomUsosAtuais(cupomExistente) : 0;

        if (!original || maxUso <= 0 || valor <= 0) {
            window.showToast('Preencha validade, máximo de uso e valor do desconto.', true);
            return;
        }

        window.mostrarLoading(true);
        try {
            await setDoc(doc(db, "cupons", original), {
                codigo: original,
                dataValidade: document.getElementById('edit-cupom-validade').value,
                quantidadeDisponivel: maxUso,
                usosAtuais: Math.min(usosAtuais, maxUso),
                tipo,
                valor,
                valorMinimo,
                ativo,
                statusCupom,
                updatedAt: Date.now()
            }, { merge: true });

            window.showToast('Cupom atualizado!');
            window.closeModal('modal-editar-cupom', 'form-edit-cupom');
        } catch (err) {
            console.error(err);
            window.showToast('Erro ao atualizar cupom.', true);
        }
        window.mostrarLoading(false);
    };
}

const formCupom = document.getElementById('form-cupom');
if (formCupom) {
    formCupom.onsubmit = async function(e) {
        e.preventDefault();

        const original = document.getElementById('cupom-id-original').value.trim().toUpperCase();
        const codigo = document.getElementById('cupom-codigo').value.trim().toUpperCase().replace(/\s+/g, '');
        const validade = document.getElementById('cupom-validade').value;
        const maxUso = parseInt(document.getElementById('cupom-max-uso').value, 10) || 0;
        const cupomExistente = original ? window.allCupons.find(c => c.id === original) : null;
        const usosAtuais = cupomExistente ? getCupomUsosAtuais(cupomExistente) : 0;
        const statusCupom = cupomExistente ? getStatusOperacionalCupom(cupomExistente) : 'ativo';
        const tipo = document.getElementById('cupom-tipo').value;
        const valor = converterValorParaNumero(document.getElementById('cupom-valor').value || 0);
        const valorMinimo = converterValorParaNumero(document.getElementById('cupom-minimo').value || 0);
        const ativo = statusCupom === 'ativo';

        if (!codigo || !validade || maxUso <= 0 || valor <= 0) {
            window.showToast('Preencha código, validade, máximo de uso e valor do desconto.', true);
            return;
        }

        window.mostrarLoading(true);
        try {
            const payload = {
                codigo,
                dataValidade: validade,
                quantidadeDisponivel: maxUso,
                usosAtuais: Math.min(usosAtuais, maxUso),
                tipo,
                valor,
                valorMinimo,
                ativo,
                statusCupom,
                updatedAt: Date.now()
            };

            if (!original) payload.createdAt = Date.now();

            if (original && original !== codigo) {
                await deleteDoc(doc(db, "cupons", original));
            }

            await setDoc(doc(db, "cupons", codigo), payload, { merge: true });
            window.showToast('Cupom salvo!');
            window.limparFormCupom();
        } catch (err) {
            console.error(err);
            window.showToast('Erro ao salvar cupom.', true);
        }
        window.mostrarLoading(false);
    };
}


async function init() {
    window.addVariation(false);
    // OTIMIZAÇÃO: categorias e produtos não dependem um do outro, então podem
    // ser buscados em paralelo em vez de esperar um terminar pra começar o outro.
    // Isso reduz o tempo até o painel ficar utilizável no carregamento inicial.
    await Promise.all([syncCats(), loadProds()]);
    loadAvisos();
    loadTema(); 
    loadCarrossel(); 
    window.inicializarKanban(); 
    window.setFiltroSemanaAtualVisivel();
    listenPedidos(); 
    window.carregarConfigAgendaGeral();
    window.carregarExcecoesLista(); // <-- Carrega a nova lista de exceções
    window.loadCupons?.();
    window.inicializarGastos?.();
}



// ==========================================
// MÓDULO DE GASTOS - PLANILHA MENSAL
// ==========================================
function escapeHTMLGasto(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizarBuscaGasto(valor) {
    return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function valorNumeroGasto(valor) {
    if (typeof converterValorParaNumero === 'function') return converterValorParaNumero(valor);
    if (typeof valor === 'number') return valor;
    const texto = String(valor || '0').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    return Number(texto) || 0;
}

function formatarMoedaGasto(valor) {
    return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseDataGasto(valor) {
    return parseDataBR(valor) || parseDataISO(valor);
}

function getAnoGastosSelecionado() {
    const select = document.getElementById('gastos-ano');
    return Number(select?.value || new Date().getFullYear());
}

function getMesGasto(l) {
    const d = parseDataGasto(l?.dataCompra || l?.Data_Compra || '');
    return d ? d.getMonth() + 1 : Number(l?.mes || 0);
}

function getAnoGasto(l) {
    const d = parseDataGasto(l?.dataCompra || l?.Data_Compra || '');
    return d ? d.getFullYear() : Number(l?.ano || 0);
}

function getItemGasto(id) {
    return allGastosItens.find(i => i.id === id);
}

function lancamentosDoItemMes(itemId, mes, ano) {
    return allGastosLancamentos.filter(l => l.itemId === itemId && getMesGasto(l) === Number(mes) && getAnoGasto(l) === Number(ano));
}

function totalLancamentos(lista) {
    return lista.reduce((acc, l) => acc + valorNumeroGasto(l.valorTotal), 0);
}

function quantidadeLancamentos(lista) {
    return lista.reduce((acc, l) => acc + (Number(l.quantidade) || 0), 0);
}

function dataDefaultGasto(mes, ano) {
    const hoje = new Date();
    if (hoje.getFullYear() === Number(ano) && hoje.getMonth() + 1 === Number(mes)) {
        return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    }
    return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

function atualizarSelectAnoGastos() {
    const select = document.getElementById('gastos-ano');
    if (!select) return;
    const atual = select.value || String(new Date().getFullYear());
    const anos = new Set([new Date().getFullYear(), Number(atual)]);
    allGastosLancamentos.forEach(l => { const a = getAnoGasto(l); if (a) anos.add(a); });
    select.innerHTML = [...anos].sort((a, b) => b - a).map(a => `<option value="${a}">Ano: ${a}</option>`).join('');
    select.value = atual;
}

function calcularResumoGastosItem(item, ano) {
    const porMes = {};
    for (let mes = 1; mes <= 12; mes++) {
        const lista = lancamentosDoItemMes(item.id, mes, ano);
        porMes[mes] = { total: totalLancamentos(lista), qtd: quantidadeLancamentos(lista), count: lista.length };
    }
    return porMes;
}

window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;
    atualizarSelectAnoGastos();
    const ano = getAnoGastosSelecionado();
    const busca = normalizarBuscaGasto(document.getElementById('gastos-busca')?.value || '');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

    let itens = [...allGastosItens].sort((a, b) => {
        const ao = Number(a.ordem || a.createdAt || 0);
        const bo = Number(b.ordem || b.createdAt || 0);
        if (ao !== bo) return ao - bo;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
    });

    if (busca) itens = itens.filter(item => normalizarBuscaGasto(item.nome).includes(busca));

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="13" class="gastos-empty">Nenhum item cadastrado. Clique em “Novo Item”.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const totalGeral = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        html += `<tr class="gastos-item-row">`;
        html += `<td class="gastos-sticky-col">
            <button class="gastos-item-btn" onclick="window.abrirGastosItem('${item.id}', gastosMesAberto || (new Date().getMonth()+1))"><span>${escapeHTMLGasto(item.nome)}</span><i class="fas ${gastosItemAberto === item.id ? 'fa-chevron-up' : 'fa-chevron-down'}"></i></button>
            <span class="gastos-item-total-geral">Total no ano: ${formatarMoedaGasto(totalGeral)}</span>
            <div class="gastos-item-actions"><button class="gastos-mini-btn edit" title="Editar item" onclick="window.renomearItemGasto('${item.id}')"><i class="fas fa-pencil-alt"></i></button><button class="gastos-mini-btn danger" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')"><i class="fas fa-trash"></i></button></div>
        </td>`;
        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            html += `<td class="gastos-mes-cell" onclick="window.abrirGastosItem('${item.id}', ${mes})"><span class="gastos-mes-total">${formatarMoedaGasto(r.total || 0)}</span><span class="gastos-mes-qtd">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span></td>`;
        }
        html += `</tr>`;

        if (gastosItemAberto === item.id) {
            html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
        }
    });

    const totalAno = totaisMes.reduce((acc, v) => acc + v, 0);
    html += `<tr class="gastos-total-row"><td class="gastos-sticky-col">TOTAL DESPESAS<br><small>${formatarMoedaGasto(totalAno)}</small></td>`;
    for (let mes = 1; mes <= 12; mes++) html += `<td>${formatarMoedaGasto(totaisMes[mes] || 0)}</td>`;
    html += `</tr>`;

    body.innerHTML = html;
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => String(a.dataCompra || '').localeCompare(String(b.dataCompra || '')));
    const totalMes = totalLancamentos(lista);
    const tabs = meses.map((m, idx) => `<button class="${idx + 1 === Number(mesAtivo) ? 'active' : ''}" onclick="window.abrirGastosItem('${item.id}', ${idx + 1})">${m}</button>`).join('');
    const dataPadrao = dataDefaultGasto(mesAtivo, ano);

    const linhas = lista.length ? lista.map(l => `
        <tr>
            <td>${escapeHTMLGasto(l.nome || item.nome)}</td>
            <td>${escapeHTMLGasto(l.marca || '-')}</td>
            <td>${escapeHTMLGasto(l.peso || '-')}</td>
            <td>${(Number(l.quantidade) || 0).toLocaleString('pt-BR')}</td>
            <td>${formatarMoedaGasto(l.valorUnidade)}</td>
            <td><strong style="color:#c0392b;">${formatarMoedaGasto(l.valorTotal)}</strong></td>
            <td>${escapeHTMLGasto(l.comprador || '-')}</td>
            <td>${formatarDataInputParaBR(l.dataCompra || '') || '-'}</td>
            <td style="white-space:nowrap;"><div class="gastos-lanc-acoes"><button class="gastos-mini-btn edit" title="Editar lançamento" onclick="window.preencherLancamentoGasto('${l.id}')"><i class="fas fa-pencil-alt"></i></button><button class="gastos-mini-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button></div></td>
        </tr>`).join('') : `<tr><td colspan="9" style="text-align:center; color:#777; padding:18px !important;">Nenhum lançamento neste mês.</td></tr>`;

    return `<tr class="gastos-drawer-row"><td colspan="13"><div class="gastos-drawer" id="gasto-drawer-${item.id}">
        <div class="gastos-drawer-header"><div class="gastos-drawer-title">${escapeHTMLGasto(item.nome)} — ${meses[mesAtivo - 1]}/${ano}</div><div><strong>Total do mês: <span style="color:#c0392b;">${formatarMoedaGasto(totalMes)}</span></strong></div></div>
        <div class="gastos-month-tabs">${tabs}</div>
        <div class="gastos-lancamento-form" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
            <input type="hidden" class="gasto-lanc-id" value="">
            <div><label>Nome do item</label><input class="gasto-lanc-nome" type="text" value="${escapeHTMLGasto(item.nome)}"></div>
            <div><label>Marca</label><input class="gasto-lanc-marca" type="text" placeholder="Ex: Deline"></div>
            <div><label>Kg/L</label><input class="gasto-lanc-peso" type="text" placeholder="Ex: 1kg ou 1L"></div>
            <div><label>Quantidade</label><input class="gasto-lanc-qtd" type="number" min="0" step="0.001" value="1" oninput="window.atualizarTotalLancamentoGasto(this)"></div>
            <div><label>Unidade</label><input class="gasto-lanc-unit" type="number" min="0" step="0.01" placeholder="0,00" oninput="window.atualizarTotalLancamentoGasto(this)"></div>
            <div><label>Valor total</label><input class="gasto-lanc-total" type="number" min="0" step="0.01" placeholder="0,00"></div>
            <div><label>Comprador</label><select class="gasto-lanc-comprador"><option value="Caixa">Caixa</option><option value="Arabela">Arabela</option><option value="Flávio">Flávio</option></select></div>
            <div><label>Data</label><input class="gasto-lanc-data" type="date" value="${dataPadrao}"></div>
            <button class="btn btn-primary" type="button" onclick="window.salvarLancamentoGasto('${item.id}')">Salvar</button>
        </div>
        <table class="gastos-lancamentos-table"><thead><tr><th>Nome</th><th>Marca</th><th>Kg/L</th><th>Quantidade</th><th>Valor da unidade</th><th>Total</th><th>Comprador</th><th>Data</th><th>Ações</th></tr></thead><tbody>${linhas}</tbody></table>
    </div></td></tr>`;
};

window.abrirGastosItem = function(itemId, mes = null) {
    gastosItemAberto = gastosItemAberto === itemId && (!mes || gastosMesAberto === Number(mes)) ? itemId : itemId;
    gastosMesAberto = Number(mes || gastosMesAberto || (new Date().getMonth() + 1));
    window.renderGastosPlanilha();
};

window.adicionarItemGasto = async function() {
    const nome = prompt('Nome do novo item de gasto:');
    if (!nome || !nome.trim()) return;
    try {
        await addDoc(collection(db, 'gastos_itens'), { nome: nome.trim(), ordem: Date.now(), createdAt: Date.now() });
        window.showToast('Item criado!');
    } catch (e) { console.error(e); window.showToast('Erro ao criar item.', true); }
};

window.renomearItemGasto = async function(itemId) {
    const item = getItemGasto(itemId);
    if (!item) return;
    const novo = prompt('Novo nome do item:', item.nome || '');
    if (!novo || !novo.trim()) return;
    try {
        await updateDoc(doc(db, 'gastos_itens', itemId), { nome: novo.trim(), updatedAt: Date.now() });
        const vinculados = allGastosLancamentos.filter(l => l.itemId === itemId);
        await Promise.all(vinculados.map(l => updateDoc(doc(db, 'gastos_lancamentos', l.id), { itemNome: novo.trim() }).catch(() => null)));
        window.showToast('Item renomeado!');
    } catch(e) { console.error(e); window.showToast('Erro ao renomear item.', true); }
};

window.excluirItemGasto = function(itemId) {
    const item = getItemGasto(itemId);
    if (!item) return;
    customConfirm(`Excluir o item "${item.nome}" e todos os lançamentos vinculados?`, async () => {
        try {
            await Promise.all(allGastosLancamentos.filter(l => l.itemId === itemId).map(l => deleteDoc(doc(db, 'gastos_lancamentos', l.id))));
            await deleteDoc(doc(db, 'gastos_itens', itemId));
            if (gastosItemAberto === itemId) gastosItemAberto = null;
            window.showToast('Item excluído!');
        } catch(e) { console.error(e); window.showToast('Erro ao excluir item.', true); }
    });
};

window.atualizarTotalLancamentoGasto = function(elemento) {
    const form = elemento.closest('.gastos-lancamento-form');
    if (!form) return;
    const qtd = Number(form.querySelector('.gasto-lanc-qtd')?.value || 0);
    const unit = Number(form.querySelector('.gasto-lanc-unit')?.value || 0);
    const total = form.querySelector('.gasto-lanc-total');
    if (total) total.value = (qtd * unit).toFixed(2);
};

window.salvarLancamentoGasto = async function(itemId) {
    const item = getItemGasto(itemId);
    const form = document.querySelector(`.gastos-lancamento-form[data-item-id="${itemId}"]`);
    if (!item || !form) return;

    const lancId = form.querySelector('.gasto-lanc-id').value || '';
    const nome = form.querySelector('.gasto-lanc-nome').value.trim() || item.nome;
    const marca = form.querySelector('.gasto-lanc-marca').value.trim();
    const peso = form.querySelector('.gasto-lanc-peso').value.trim();
    const quantidade = Number(form.querySelector('.gasto-lanc-qtd').value || 0);
    const valorUnidade = Number(form.querySelector('.gasto-lanc-unit').value || 0);
    let valorTotal = Number(form.querySelector('.gasto-lanc-total').value || 0);
    const comprador = form.querySelector('.gasto-lanc-comprador').value;
    const dataCompra = form.querySelector('.gasto-lanc-data').value || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());

    if (!valorTotal && quantidade && valorUnidade) valorTotal = quantidade * valorUnidade;
    if (!nome || !dataCompra || !comprador) return window.showToast('Preencha nome, data e comprador.', true);

    const dataObj = parseDataISO(dataCompra);
    const payload = {
        itemId,
        itemNome: item.nome,
        nome,
        marca,
        peso,
        quantidade,
        valorUnidade,
        valorTotal,
        comprador,
        dataCompra,
        ano: dataObj ? dataObj.getFullYear() : getAnoGastosSelecionado(),
        mes: dataObj ? dataObj.getMonth() + 1 : gastosMesAberto,
        updatedAt: Date.now()
    };

    try {
        if (lancId) await updateDoc(doc(db, 'gastos_lancamentos', lancId), payload);
        else await addDoc(collection(db, 'gastos_lancamentos'), { ...payload, createdAt: Date.now() });
        window.showToast(lancId ? 'Lançamento atualizado!' : 'Lançamento salvo!');
        form.querySelector('.gasto-lanc-id').value = '';
        form.querySelector('.gasto-lanc-nome').value = item.nome;
        form.querySelector('.gasto-lanc-marca').value = '';
        form.querySelector('.gasto-lanc-peso').value = '';
        form.querySelector('.gasto-lanc-qtd').value = '1';
        form.querySelector('.gasto-lanc-unit').value = '';
        form.querySelector('.gasto-lanc-total').value = '';
        form.querySelector('.gasto-lanc-comprador').value = 'Caixa';
    } catch(e) { console.error(e); window.showToast('Erro ao salvar lançamento.', true); }
};

window.preencherLancamentoGasto = function(lancId) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;
    gastosItemAberto = l.itemId;
    gastosMesAberto = getMesGasto(l) || gastosMesAberto;
    window.renderGastosPlanilha();
    setTimeout(() => {
        const form = document.querySelector(`.gastos-lancamento-form[data-item-id="${l.itemId}"]`);
        if (!form) return;
        form.querySelector('.gasto-lanc-id').value = l.id;
        form.querySelector('.gasto-lanc-nome').value = l.nome || l.itemNome || '';
        form.querySelector('.gasto-lanc-marca').value = l.marca || '';
        form.querySelector('.gasto-lanc-peso').value = l.peso || '';
        form.querySelector('.gasto-lanc-qtd').value = l.quantidade || 0;
        form.querySelector('.gasto-lanc-unit').value = l.valorUnidade || 0;
        form.querySelector('.gasto-lanc-total').value = l.valorTotal || 0;
        form.querySelector('.gasto-lanc-comprador').value = l.comprador || 'Caixa';
        form.querySelector('.gasto-lanc-data').value = l.dataCompra || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());
        form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
};

window.excluirLancamentoGasto = function(lancId) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    const ehParcelado = !!(l && l.parcelaGrupoId && Number(l.parcelaTotal) > 1);

    if (!ehParcelado) {
        customConfirm('Excluir este lançamento de gasto?', async () => {
            try { await deleteDoc(doc(db, 'gastos_lancamentos', lancId)); window.showToast('Lançamento excluído!'); }
            catch(e) { console.error(e); window.showToast('Erro ao excluir lançamento.', true); }
        });
        return;
    }

    window.abrirConfirmExclusaoParcelaGasto(l);
};

// NOVO (2026-08): lançamento parcelado - oferece excluir só esta parcela ou todas as
// parcelas do mesmo grupo (parcelaGrupoId), em vez de excluir sempre uma por uma.
window.abrirConfirmExclusaoParcelaGasto = function(l) {
    const membros = allGastosLancamentos.filter(x => x.parcelaGrupoId === l.parcelaGrupoId);
    const total = l.parcelaTotal || membros.length || 1;

    const msgEl = document.getElementById('excl-parc-msg');
    if (msgEl) msgEl.textContent = `Esta compra está parcelada em ${total}x (parcela ${l.parcelaAtual || 1} de ${total}). O que deseja excluir?`;

    window.openModal('modal-excluir-parcela-gasto');

    const btnUma = document.getElementById('excl-parc-btn-uma');
    const btnTodas = document.getElementById('excl-parc-btn-todas');
    if (!btnUma || !btnTodas) return;

    // Clona os botões pra remover listeners de aberturas anteriores (mesmo padrão do customConfirm).
    const novoBtnUma = btnUma.cloneNode(true);
    btnUma.parentNode.replaceChild(novoBtnUma, btnUma);
    const novoBtnTodas = btnTodas.cloneNode(true);
    btnTodas.parentNode.replaceChild(novoBtnTodas, btnTodas);

    novoBtnUma.addEventListener('click', async () => {
        window.closeModal('modal-excluir-parcela-gasto');
        try {
            await deleteDoc(doc(db, 'gastos_lancamentos', l.id));
            window.showToast('Parcela excluída!');
        } catch(e) {
            console.error(e);
            window.showToast('Erro ao excluir lançamento.', true);
        }
    });

    novoBtnTodas.addEventListener('click', async () => {
        window.closeModal('modal-excluir-parcela-gasto');
        try {
            const membrosAtuais = allGastosLancamentos.filter(x => x.parcelaGrupoId === l.parcelaGrupoId);
            await Promise.all(membrosAtuais.map(m => deleteDoc(doc(db, 'gastos_lancamentos', m.id))));
            window.showToast(`${membrosAtuais.length} parcelas excluídas!`);
        } catch(e) {
            console.error(e);
            window.showToast('Erro ao excluir as parcelas.', true);
        }
    });
};

function calcularTotaisGastosPorPeriodo(inicio = null, fim = null) {
    const totais = { caixa: 0, arabela: 0, flavio: 0, total: 0 };
    allGastosLancamentos.forEach(l => {
        const data = parseDataGasto(l.dataCompra || '');
        if (!data) return;
        if (inicio && data.getTime() < inicio.getTime()) return;
        if (fim && data.getTime() > fim.getTime()) return;
        const valor = valorNumeroGasto(l.valorTotal);
        const comprador = normalizarBuscaGasto(l.comprador || 'Caixa');
        if (comprador.includes('ara')) totais.arabela += valor;
        else if (comprador.includes('fla')) totais.flavio += valor;
        else totais.caixa += valor;
        totais.total += valor;
    });
    return totais;
}

function calcularTotaisGastosPorPeriodoFechamento() {
    let inicio = null;
    let fim = null;

    if (window.dataInicialIntervalo) {
        inicio = new Date(window.dataInicialIntervalo);
        fim = new Date(window.dataFinalIntervalo || window.dataInicialIntervalo);
    } else if (window.pedidosFechamento && window.pedidosFechamento.length) {
        const datas = window.pedidosFechamento.map(p => parseDataBR(p.Data_Entrega)).filter(Boolean).sort((a, b) => a - b);
        if (datas.length) {
            inicio = datas[0];
            fim = datas[datas.length - 1];
        }
    }

    if (inicio) inicio.setHours(0,0,0,0);
    if (fim) fim.setHours(0,0,0,0);

    const totais = calcularTotaisGastosPorPeriodo(inicio, fim);
    window.totalGastosLancadosPeriodoAtual = totais.total;
    return totais;
}

// NOTA (limpeza de performance): existia aqui uma segunda definição de
// window.inicializarGastos, idêntica em espírito à definição mais completa
// que está abaixo (perto de "EXPORTAR PEDIDOS PARA EXCEL/CSV"). Como JS usa
// a última atribuição feita a window.inicializarGastos, essa primeira versão
// nunca era executada — era código morto que só aumentava o tamanho do
// arquivo e registrava listeners que seriam imediatamente substituídos.
// Foi removida; a versão funcional continua mais abaixo no arquivo.





// === GASTOS PLANILHA AJUSTE ITEM TOTAL FILTROS 2026-06-21 ===
window.allGastosMarcas = window.allGastosMarcas || [];

window.normalizarMarcaGasto = function(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

window.marcasGastosDisponiveis = function() {
    const mapa = new Map();

    (window.allGastosMarcas || []).forEach(m => {
        const nome = String(m.nome || m.marca || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !mapa.has(chave)) mapa.set(chave, nome);
    });

    allGastosLancamentos.forEach(l => {
        const nome = String(l.marca || l.nome || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !mapa.has(chave)) mapa.set(chave, nome);
    });

    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
};

window.renderOptionsMarcaGasto = function(marcaSelecionada = '') {
    const marcas = window.marcasGastosDisponiveis();
    const marcaAtual = String(marcaSelecionada || '').trim();
    const chaveAtual = window.normalizarMarcaGasto(marcaAtual);
    const existe = marcas.some(m => window.normalizarMarcaGasto(m) === chaveAtual);

    let html = `<option value="">Selecione...</option>`;
    marcas.forEach(m => {
        html += `<option value="${escapeHTMLGasto(m)}" ${window.normalizarMarcaGasto(m) === chaveAtual ? 'selected' : ''}>${escapeHTMLGasto(m)}</option>`;
    });
    html += `<option value="__outros__" ${marcaAtual && !existe ? 'selected' : ''}>Outros</option>`;
    return html;
};

window.criarLinhaLancamentoGastoHTML = function(dados = {}) {
    const id = dados.id || '';
    const marca = String(dados.marca || dados.nome || '').trim();
    const marcas = window.marcasGastosDisponiveis();
    const usarOutros = marca && !marcas.some(m => window.normalizarMarcaGasto(m) === window.normalizarMarcaGasto(marca));
    const qtd = dados.quantidade !== undefined && dados.quantidade !== null ? dados.quantidade : 1;
    const unit = dados.valorUnidade !== undefined && dados.valorUnidade !== null ? dados.valorUnidade : '';
    const total = dados.valorTotal !== undefined && dados.valorTotal !== null ? dados.valorTotal : ((Number(qtd) || 0) * (Number(unit) || 0));
    const comprador = dados.comprador || 'Caixa';
    const data = dados.dataCompra || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());

    return `<div class="gasto-lanc-row">
        <input type="hidden" class="gasto-lanc-id" value="${escapeHTMLGasto(id)}">
        <div>
            <label>Marca</label>
            <div class="gasto-marca-select-wrap">
                <select class="gasto-lanc-marca-select" onchange="window.toggleMarcaOutrosGasto(this)">
                    ${window.renderOptionsMarcaGasto(usarOutros ? '__outros__' : marca)}
                </select>
                <button type="button" class="gasto-marca-delete-btn" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada">×</button>
            </div>
            <input class="gasto-lanc-marca-outros" type="text" placeholder="Nova marca" value="${usarOutros ? escapeHTMLGasto(marca) : ''}" style="${usarOutros ? '' : 'display:none;'}">
        </div>
        <div><label>Kg/L</label><input class="gasto-lanc-peso" type="text" placeholder="Ex: 1kg ou 1L" value="${escapeHTMLGasto(dados.peso || '')}"></div>
        <div><label>Quantidade</label><input class="gasto-lanc-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(qtd)}" oninput="window.atualizarTotalLancamentoGasto(this)"></div>
        <div><label>Unidade</label><input class="gasto-lanc-unit" type="number" min="0" step="0.01" placeholder="0,00" value="${escapeHTMLGasto(unit)}" oninput="window.atualizarTotalLancamentoGasto(this)"></div>
        <div><label>Valor total</label><input class="gasto-lanc-total" type="number" min="0" step="0.01" placeholder="0,00" value="${Number(total || 0).toFixed(2)}" readonly></div>
        <div><label>Comprador</label><select class="gasto-lanc-comprador"><option value="Caixa" ${comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></div>
        <div><label>Data</label><input class="gasto-lanc-data" type="date" value="${escapeHTMLGasto(data)}"></div>
        <button class="gastos-icon-btn danger gastos-remover-linha" type="button" onclick="window.removerLinhaLancamentoGasto(this)" title="Remover linha"><i class="fas fa-trash"></i></button>
    </div>`;
};

window.toggleMarcaOutrosGasto = function(select) {
    const row = select.closest('.gasto-lanc-row, tr');
    const inputOutros = row?.querySelector('.gasto-lanc-marca-outros, .gasto-list-marca-outros');
    if (!inputOutros) return;
    inputOutros.style.display = select.value === '__outros__' ? '' : 'none';
    if (select.value === '__outros__') inputOutros.focus();
};

window.getMarcaDaLinhaGasto = function(row, seletorSelect = '.gasto-lanc-marca-select', seletorOutros = '.gasto-lanc-marca-outros') {
    const select = row.querySelector(seletorSelect);
    if (!select) return '';
    if (select.value === '__outros__') return String(row.querySelector(seletorOutros)?.value || '').trim();
    return String(select.value || '').trim();
};

window.garantirMarcaGasto = async function(marca) {
    const nome = String(marca || '').trim();
    if (!nome) return;
    const chave = window.normalizarMarcaGasto(nome);
    const existente = (window.allGastosMarcas || []).find(m => window.normalizarMarcaGasto(m.nome || m.marca) === chave);
    if (existente) return;
    try { await addDoc(collection(db, 'gastos_marcas'), { nome, createdAt: Date.now() }); }
    catch(e) { console.warn('Não foi possível salvar marca nova:', e); }
};

window.excluirMarcaSelecionadaGasto = function(botao) {
    const wrap = botao.closest('.gasto-marca-select-wrap');
    const select = wrap?.querySelector('select');
    const valor = select?.value || '';
    if (!valor || valor === '__outros__') return window.showToast('Selecione uma marca cadastrada para excluir.', true);
    window.excluirMarcaGasto(valor);
};

window.excluirMarcaGasto = function(nomeMarca) {
    const nome = String(nomeMarca || '').trim();
    if (!nome) return;
    customConfirm(`Excluir a marca "${nome}" da lista de opções?`, async () => {
        try {
            const chave = window.normalizarMarcaGasto(nome);
            const marcas = (window.allGastosMarcas || []).filter(m => window.normalizarMarcaGasto(m.nome || m.marca) === chave);
            await Promise.all(marcas.map(m => deleteDoc(doc(db, 'gastos_marcas', m.id))));
            window.showToast('Marca removida da lista!');
        } catch(e) {
            console.error(e);
            window.showToast('Erro ao remover marca.', true);
        }
    });
};

window.renderMarcasChipsGasto = function() { return ''; };

window.atualizarFiltroItensGastos = function(valorAtual = '') {
    const select = document.getElementById('gastos-filtro-item');
    if (!select) return;
    const atual = valorAtual || select.value || '';
    const itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    select.innerHTML = `<option value="">Todos os itens</option>` + itens.map(item => `<option value="${item.id}">${escapeHTMLGasto(item.nome || '')}</option>`).join('');
    if (atual && itens.some(item => item.id === atual)) select.value = atual;
};

window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;
    const ano = getAnoGastosSelecionado();
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const busca = normalizarBuscaGasto(document.getElementById('gastos-busca')?.value || '');
    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';
    window.atualizarFiltroItensGastos(filtroItem);

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (filtroItem) itens = itens.filter(item => item.id === filtroItem);
    if (busca) itens = itens.filter(item => normalizarBuscaGasto(item.nome).includes(busca));

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="13" class="gastos-empty">Nenhum item encontrado.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const totalGeral = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        const nomeSeguro = escapeHTMLGasto(item.nome || '');

        html += `<tr class="gastos-item-row" data-gasto-item-row="${item.id}">`;
        html += `<td class="gastos-sticky-col">
            <div class="gastos-categoria-cell">
                <div class="gastos-item-nome-wrap">
                    <input class="gastos-categoria-nome-input" value="${nomeSeguro}" 
                        onblur="window.renomearCategoriaGastoInline(this, '${item.id}')"
                        onkeydown="if(event.key==='Enter'){this.blur();}"
                        title="Clique para renomear">
                    <button class="gastos-categoria-excluir" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')">×</button>
                </div>
                <span class="gastos-item-total-geral">Total no ano: ${formatarMoedaGasto(totalGeral)}</span>
            </div>
        </td>`;

        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            const ativo = gastosItemAberto === item.id && Number(gastosMesAberto) === mes ? ' active' : '';
            html += `<td class="gastos-mes-cell${ativo}" onclick="window.abrirGastosItem('${item.id}', ${mes})">
                <span class="gastos-mes-total">${formatarMoedaGasto(r.total || 0)}</span>
                <span class="gastos-mes-qtd">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span>
            </td>`;
        }
        html += `</tr>`;

        if (gastosItemAberto === item.id) html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
    });

    html += `<tr class="gastos-total-row"><td class="gastos-sticky-col">TOTAL MENSAL</td>`;
    for (let mes = 1; mes <= 12; mes++) html += `<td>${formatarMoedaGasto(totaisMes[mes] || 0)}</td>`;
    html += `</tr>`;

    body.innerHTML = html;
};

window.renderCampoMarcaListaGasto = function(l) {
    const marca = String(l.marca || l.nome || '').trim();
    const marcas = window.marcasGastosDisponiveis();
    const usarOutros = marca && !marcas.some(m => window.normalizarMarcaGasto(m) === window.normalizarMarcaGasto(marca));
    return `<div class="gasto-marca-select-wrap"><select class="gasto-list-marca-select" onchange="window.toggleMarcaOutrosGasto(this); window.salvarCampoLancamentoGasto('${l.id}', this)">
        ${window.renderOptionsMarcaGasto(usarOutros ? '__outros__' : marca)}
    </select><button type="button" class="gasto-marca-delete-btn" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada">×</button></div><input class="gasto-list-marca-outros" value="${usarOutros ? escapeHTMLGasto(marca) : ''}" placeholder="Nova marca" style="${usarOutros ? '' : 'display:none;'}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)">`;
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });
    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const tabelaLancamentos = lista.length ? `
        <table class="gastos-lancamentos-table">
            <thead><tr><th>Marca</th><th>Kg/L</th><th>Quantidade</th><th>Valor da unidade</th><th>Total</th><th>Comprador</th><th>Data</th><th>Ações</th></tr></thead>
            <tbody>${lista.map(l => `
                <tr>
                    <td>${window.renderCampoMarcaListaGasto(l)}</td>
                    <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                    <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                    <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td class="gastos-lanc-acoes">
                        <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                        <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>` : '';

    return `<tr class="gastos-drawer-row"><td colspan="13"><div class="gastos-drawer" id="gasto-drawer-${item.id}">
        <div class="gastos-drawer-header">
            <div class="gastos-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
            <div class="gastos-drawer-header-actions"><button class="gastos-fechar-drawer" onclick="window.fecharGastosItem()" title="Fechar">×</button></div>
        </div>
        <div class="gastos-adicao-envelope">
            <div class="gastos-adicao-topo">
                <strong>Lançar itens</strong>
                <div>
                    <button class="gastos-icon-btn gastos-add-line-btn" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')"><i class="fas fa-plus"></i></button>
                    <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                </div>
            </div>
            <div class="gastos-lancamento-lista" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
            </div>
        </div>
        ${tabelaLancamentos}
    </div></td></tr>`;
};

window.adicionarLinhaLancamentoGasto = function(itemId, dados = {}) {
    const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${itemId}"]`);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', window.criarLinhaLancamentoGastoHTML(dados));
};

window.removerLinhaLancamentoGasto = function(btn) {
    const row = btn.closest('.gasto-lanc-row');
    const id = row?.querySelector('.gasto-lanc-id')?.value || '';
    if (id) { row.classList.add('gasto-lanc-row-removida'); row.style.display = 'none'; }
    else row?.remove();
};

window.abrirGastosItem = function(itemId, mes = null) {
    const mesNormalizado = Number(mes || gastosMesAberto || (new Date().getMonth() + 1));
    if (gastosItemAberto === itemId && Number(gastosMesAberto) === mesNormalizado) {
        gastosItemAberto = null;
        gastosMesAberto = mesNormalizado;
    } else {
        gastosItemAberto = itemId;
        gastosMesAberto = mesNormalizado;
    }
    window.renderGastosPlanilha();
};

window.fecharGastosItem = function() {
    gastosItemAberto = null;
    window.renderGastosPlanilha();
};

window.adicionarItemGasto = async function() {
    const nome = prompt('Nome do novo item:');
    if (!nome || !nome.trim()) return;
    try {
        await addDoc(collection(db, 'gastos_itens'), { nome: nome.trim(), ordem: Date.now(), createdAt: Date.now() });
        window.showToast('Item criado!');
    } catch (e) { console.error(e); window.showToast('Erro ao criar item.', true); }
};

window.renomearCategoriaGastoInline = async function(input, itemId) {
    const item = getItemGasto(itemId);
    if (!item || !input) return;
    const novo = String(input.value || '').trim();
    if (!novo) { input.value = item.nome || ''; return window.showToast('Informe um nome para o item.', true); }
    if (novo === (item.nome || '')) return;
    try {
        await updateDoc(doc(db, 'gastos_itens', itemId), { nome: novo, updatedAt: Date.now() });
        const vinculados = allGastosLancamentos.filter(l => l.itemId === itemId);
        await Promise.all(vinculados.map(l => updateDoc(doc(db, 'gastos_lancamentos', l.id), { itemNome: novo }).catch(() => null)));
        window.showToast('Item renomeado!');
    } catch(e) {
        console.error(e);
        input.value = item.nome || '';
        window.showToast('Erro ao renomear item.', true);
    }
};

window.atualizarTotalLancamentoGasto = function(elemento) {
    const row = elemento.closest('.gasto-lanc-row');
    if (!row) return;
    const qtd = Number(row.querySelector('.gasto-lanc-qtd')?.value || 0);
    const unit = Number(row.querySelector('.gasto-lanc-unit')?.value || 0);
    const total = row.querySelector('.gasto-lanc-total');
    if (total) total.value = (qtd * unit).toFixed(2);
};

window.salvarLancamentosGasto = async function(itemId) {
    const item = getItemGasto(itemId);
    const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${itemId}"]`);
    if (!item || !container) return;
    const rows = Array.from(container.querySelectorAll('.gasto-lanc-row'));
    let salvou = 0;
    try {
        for (const row of rows) {
            if (row.classList.contains('gasto-lanc-row-removida')) continue;
            const lancId = row.querySelector('.gasto-lanc-id')?.value || '';
            const marca = window.getMarcaDaLinhaGasto(row);
            const peso = row.querySelector('.gasto-lanc-peso')?.value.trim() || '';
            const quantidade = Number(row.querySelector('.gasto-lanc-qtd')?.value || 0);
            const valorUnidade = Number(row.querySelector('.gasto-lanc-unit')?.value || 0);
            const valorTotal = quantidade * valorUnidade;
            const comprador = row.querySelector('.gasto-lanc-comprador')?.value || 'Caixa';
            const dataCompra = row.querySelector('.gasto-lanc-data')?.value || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());
            const linhaVazia = !marca && !peso && !quantidade && !valorUnidade;
            if (linhaVazia) continue;
            if (!marca) return window.showToast('Preencha a marca.', true);
            if (!quantidade || !valorUnidade) return window.showToast('Preencha quantidade e valor unidade.', true);
            if (!dataCompra || !comprador) return window.showToast('Preencha data e comprador.', true);
            await window.garantirMarcaGasto(marca);
            const dataObj = parseDataISO(dataCompra);
            const payload = { itemId, itemNome: item.nome, nome: marca, marca, peso, quantidade, valorUnidade, valorTotal, comprador, dataCompra, ano: dataObj ? dataObj.getFullYear() : getAnoGastosSelecionado(), mes: dataObj ? dataObj.getMonth() + 1 : gastosMesAberto, updatedAt: Date.now() };
            if (lancId) await updateDoc(doc(db, 'gastos_lancamentos', lancId), payload);
            else await addDoc(collection(db, 'gastos_lancamentos'), { ...payload, createdAt: Date.now() });
            salvou++;
        }
        window.showToast(salvou ? 'Lançamentos salvos!' : 'Nenhum lançamento novo para salvar.');
        window.renderGastosPlanilha();
    } catch(e) {
        console.error(e);
        window.showToast('Erro ao salvar lançamentos.', true);
    }
};

window.salvarLancamentoGasto = async function(itemId) { return window.salvarLancamentosGasto(itemId); };

window.salvarCampoLancamentoGasto = async function(lancId, elemento) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;
    const tr = elemento.closest('tr');
    if (!tr) return;
    const marca = window.getMarcaDaLinhaGasto(tr, '.gasto-list-marca-select', '.gasto-list-marca-outros') || l.marca || l.nome || '';
    const peso = tr.querySelector('.gasto-list-peso')?.value.trim() || '';
    const quantidade = Number(tr.querySelector('.gasto-list-qtd')?.value || 0);
    const valorUnidade = Number(tr.querySelector('.gasto-list-unit')?.value || 0);
    const valorTotal = quantidade * valorUnidade;
    const comprador = tr.querySelector('.gasto-list-comprador')?.value || 'Caixa';
    const dataCompra = tr.querySelector('.gasto-list-data')?.value || l.dataCompra || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());
    const dataObj = parseDataISO(dataCompra);
    if (marca) await window.garantirMarcaGasto(marca);
    try {
        await updateDoc(doc(db, 'gastos_lancamentos', lancId), { nome: marca, marca, peso, quantidade, valorUnidade, valorTotal, comprador, dataCompra, ano: dataObj ? dataObj.getFullYear() : l.ano, mes: dataObj ? dataObj.getMonth() + 1 : l.mes, updatedAt: Date.now() });
    } catch(e) {
        console.error(e);
        window.showToast('Erro ao atualizar lançamento.', true);
    }
};

window.preencherLancamentoGasto = function(lancId) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;
    gastosItemAberto = l.itemId;
    gastosMesAberto = getMesGasto(l) || gastosMesAberto;
    window.renderGastosPlanilha();
    setTimeout(() => {
        const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${l.itemId}"]`);
        if (!container) return;
        container.innerHTML = window.criarLinhaLancamentoGastoHTML(l);
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
};

window.copiarLancamentoGasto = function(lancId) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;
    gastosItemAberto = l.itemId;
    gastosMesAberto = getMesGasto(l) || gastosMesAberto;
    window.renderGastosPlanilha();
    setTimeout(() => {
        const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${l.itemId}"]`);
        if (!container) return;
        const copia = { ...l, id: '' };
        container.insertAdjacentHTML('beforeend', window.criarLinhaLancamentoGastoHTML(copia));
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        window.showToast('Lançamento copiado para novo cadastro.');
    }, 80);
};


window.recalcularTodosLancamentosVisiveisGasto = function() {
    document.querySelectorAll('#t-gastos .gasto-lanc-row').forEach(row => {
        const qtd = Number(row.querySelector('.gasto-lanc-qtd')?.value || 0);
        const unit = Number(row.querySelector('.gasto-lanc-unit')?.value || 0);
        const total = row.querySelector('.gasto-lanc-total');
        if (total) total.value = (qtd * unit).toFixed(2);
    });
};

window.limparFiltrosGastos = function() {
    const filtroItem = document.getElementById('gastos-filtro-item');
    if (filtroItem) filtroItem.value = '';
    const busca = document.getElementById('gastos-busca');
    if (busca) busca.value = '';
    const ano = document.getElementById('gastos-ano');
    if (ano) ano.value = String(new Date().getFullYear());
    window.renderGastosPlanilha();
};

window.inicializarGastos = function() {
    const select = document.getElementById('gastos-ano');
    if (select && !select.innerHTML) {
        const anoAtual = new Date().getFullYear();
        select.innerHTML = Array.from({ length: 11 }, (_, i) => anoAtual - 5 + i).reverse().map(a => `<option value="${a}">Ano: ${a}</option>`).join('');
        select.value = String(anoAtual);
    }

    onSnapshot(collection(db, 'gastos_itens'), snap => {
        allGastosItens = [];
        snap.forEach(d => allGastosItens.push({ id: d.id, ...d.data() }));
        window.atualizarFiltroItensGastos?.();
        window.renderGastosPlanilha?.();
    });

    onSnapshot(collection(db, 'gastos_lancamentos'), snap => {
        allGastosLancamentos = [];
        snap.forEach(d => allGastosLancamentos.push({ id: d.id, ...d.data() }));
        window.renderGastosPlanilha?.();
        if (document.getElementById('modal-fechamento-financeiro')?.style.display === 'flex') window.calcularDivisaoFechamento?.();
    });

    onSnapshot(collection(db, 'gastos_marcas'), snap => {
        window.allGastosMarcas = [];
        snap.forEach(d => window.allGastosMarcas.push({ id: d.id, ...d.data() }));
        window.renderGastosPlanilha?.();
    });
};


// ==========================================
// EXPORTAR PEDIDOS PARA EXCEL/CSV
// ==========================================
window.exportarPedidosCSV = function() {
    // Pega os pedidos que estão filtrados na tela no momento
    const pedidos = window.obterPedidosFiltrados();
    
    if (pedidos.length === 0) {
        return window.showToast("Nenhum pedido para exportar na tela atual.", true);
    }

    // Cabeçalho das colunas do Excel
    let csv = "ID_do_Pedido,Cliente,Telefone,Data_Entrega,Horario_Entrega,Status_do_Pedido,Status_Pagamento,Forma_de_Pagamento,Modalidade_Credito,Total,Taxa_Pagamento,Valor_Taxa_Pagamento,Valor_Recebido\n";
    
    // Varre os pedidos e monta as linhas
    pedidos.forEach(p => {
        const id = p.ID_do_Pedido || "";
        const cliente = (p.Nome_Cliente || "").replace(/,/g, ""); // Tira vírgulas do nome para não quebrar a coluna
        const tel = p.Numero || "";
        const data = p.Data_Entrega || "";
        const hora = p.Horario_Entrega || "";
        const status = p.Status_do_Pedido || "";
        const pgto = p.Status_Pagamento || "";
        const forma = p.Forma_de_Pagamento || "";
        const total = p.Total_Final || "0,00";
        
        csv += `${id},${cliente},${tel},${data},${hora},${status},${pgto},${forma},"${total}"\n`;
    });

    // Cria o arquivo invisível e força o download no navegador
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // "\uFEFF" resolve acentos no Excel (BOM)
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Relatorio_Favu_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.csv`;
    link.click();
    
    window.showToast("Download iniciado!");
};

// O onAuthStateChanged gerencia tudo, se ele detectar login ele mostra o painel e roda o init()
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById("login-screen");
    const adminPanel = document.getElementById("admin-panel");
    
    if (user) {
        // Usuário logado
        loginScreen.style.display = "none";
        adminPanel.style.display = "block";
        init();
    } else {
        // Usuário não logado
        loginScreen.style.display = "block";
        adminPanel.style.display = "none";
        document.getElementById("login-user").value = "";
        document.getElementById("login-pass").value = "";
    }
});

// ==========================================
// FECHAMENTO FINANCEIRO E DIVISÃO (SÓCIOS)
// ==========================================
// ==========================================
// FECHAMENTO FINANCEIRO E DIVISÃO (SÓCIOS)
// ==========================================
window.gastoManualCaixaEditado = false;
window.gastoManualAraEditado = false;
window.gastoManualFlaEditado = false;

window.onGastoManualInput = function(tipo) {
    if (tipo === 'caixa') window.gastoManualCaixaEditado = true;
    if (tipo === 'ara') window.gastoManualAraEditado = true;
    if (tipo === 'fla') window.gastoManualFlaEditado = true;
    window.calcularDivisaoFechamento();
};

window.abrirModalFechamento = function() {
    window.gastoManualCaixaEditado = false;
    window.gastoManualAraEditado = false;
    window.gastoManualFlaEditado = false;
    if(document.getElementById('gasto-manual-caixa')) document.getElementById('gasto-manual-caixa').value = '';
    if(document.getElementById('gasto-manual-ara')) document.getElementById('gasto-manual-ara').value = '';
    if(document.getElementById('gasto-manual-fla')) document.getElementById('gasto-manual-fla').value = '';

    // Pega os pedidos da tela atual (idêntico ao cálculo do Dashboard)
    let pedidos = window.ticketsSelecionados.size > 0 
        ? window.todosPedidos.filter(p => window.ticketsSelecionados.has(p.ID_do_Pedido)) 
        : window.obterPedidosFiltrados();
    
    // Ignora pedidos cancelados para não somar faturamento fantasma
    pedidos = pedidos.filter(p => !(p.Status_do_Pedido || '').toLowerCase().includes('cancelado'));

    if(pedidos.length === 0) return window.showToast('Nenhum pedido para fechar!', true);

    window.pedidosFechamento = pedidos;
    
    let totalVendas = 0;
    let totalTaxasPagamento = 0;
    let total = 0;
    let datas = [];
    pedidos.forEach(p => {
        const valorPedido = calcularValorPedido(p);
        const taxaPedido = calcularTaxaPagamentoPedido(p);
        totalVendas += valorPedido;
        totalTaxasPagamento += taxaPedido;
        total += Math.max(0, valorPedido - taxaPedido);
        if(p.Data_Entrega) datas.push(p.Data_Entrega);
    });

    // NOVA LÓGICA: Puxa o período diretamente do filtro do calendário
    let periodoStr = "";
    if (window.dataInicialIntervalo) {
        const pData = window.dataInicialIntervalo;
        const uData = window.dataFinalIntervalo || window.dataInicialIntervalo;
        const pStr = String(pData.getDate()).padStart(2,'0') + '/' + String(pData.getMonth()+1).padStart(2,'0');
        const uStr = String(uData.getDate()).padStart(2,'0') + '/' + String(uData.getMonth()+1).padStart(2,'0');
        periodoStr = pStr === uStr ? pStr : `${pStr} - ${uStr}`;
    } else if (datas.length > 0) { 
        // Fallback: Se não houver filtro de data ativo, pega pelas datas dos pedidos
        const datasParsed = datas.map(d => parseDataBR(d)).filter(d => d).sort((a,b) => a-b);
        if(datasParsed.length > 0) {
            const pData = datasParsed[0];
            const uData = datasParsed[datasParsed.length-1];
            const pStr = String(pData.getDate()).padStart(2,'0') + '/' + String(pData.getMonth()+1).padStart(2,'0');
            const uStr = String(uData.getDate()).padStart(2,'0') + '/' + String(uData.getMonth()+1).padStart(2,'0');
            periodoStr = pStr === uStr ? pStr : `${pStr} - ${uStr}`;
        }
    }

    document.getElementById('fechamento-periodo').textContent = periodoStr ? `(${periodoStr})` : '';
    
    window.totalFechamentoVendasAtual = totalVendas;
    window.totalTaxasPagamentoAtual = totalTaxasPagamento;
    window.totalFechamentoAtual = total;
    window.calcularDivisaoFechamento();

    window.openModal('modal-fechamento-financeiro');
};

window.calcularDivisaoFechamento = function() {
    const totalBase = window.totalFechamentoAtual || 0;
    const totalVendasBruto = window.totalFechamentoVendasAtual ?? totalBase;
    const totalTaxasPagamento = window.totalTaxasPagamentoAtual || 0;
    
    const percCaixa = parseFloat(document.getElementById('perc-caixa').value) || 0;
    const percAra = parseFloat(document.getElementById('perc-ara').value) || 0;
    const percFla = parseFloat(document.getElementById('perc-fla').value) || 0;

    const gastosLancados = calcularTotaisGastosPorPeriodoFechamento();
    const campoGastoCaixa = document.getElementById('gasto-manual-caixa');
    const campoGastoAra = document.getElementById('gasto-manual-ara');
    const campoGastoFla = document.getElementById('gasto-manual-fla');

    if (campoGastoCaixa && !window.gastoManualCaixaEditado) campoGastoCaixa.value = (gastosLancados.caixa || 0).toFixed(2);
    if (campoGastoAra && !window.gastoManualAraEditado) campoGastoAra.value = (gastosLancados.arabela || 0).toFixed(2);
    if (campoGastoFla && !window.gastoManualFlaEditado) campoGastoFla.value = (gastosLancados.flavio || 0).toFixed(2);

    const gCaixa = parseFloat(campoGastoCaixa?.value || 0) || 0;
    const gAra = parseFloat(campoGastoAra?.value || 0) || 0;
    const gFla = parseFloat(campoGastoFla?.value || 0) || 0;

    const totalGasto = gCaixa + gAra + gFla;

    const lucroLiquido = totalBase - totalGasto;
    document.getElementById('fechamento-lucro-liquido').textContent = lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const lucroCaixa = lucroLiquido * (percCaixa / 100);
    const lucroAra = lucroLiquido * (percAra / 100);
    const lucroFla = lucroLiquido * (percFla / 100);

    const finalCaixa = lucroCaixa;
    const finalAra = lucroAra + gAra;
    const finalFla = lucroFla + gFla;

    // Define as cores dinamicamente baseado nos valores reais calculados
    const corVendas = totalVendasBruto > 0 ? 'color: #27ae60;' : totalVendasBruto < 0 ? 'color: #c0392b;' : '';
    const corTaxas = totalTaxasPagamento > 0 ? 'color: #c0392b;' : '';
    const corFaturamento = totalBase > 0 ? 'color: #27ae60;' : totalBase < 0 ? 'color: #c0392b;' : '';
    const corGastos = totalGasto > 0 ? 'color: #c0392b;' : '';
    const corLucro = lucroLiquido > 0 ? 'color: #27ae60;' : lucroLiquido < 0 ? 'color: #c0392b;' : '';

    const corCaixa = finalCaixa > 0 ? 'color: #27ae60;' : finalCaixa < 0 ? 'color: #c0392b;' : '';
    const corAra = finalAra > 0 ? 'color: #27ae60;' : finalAra < 0 ? 'color: #c0392b;' : '';
    const corLucroAra = lucroAra > 0 ? 'color: #27ae60;' : lucroAra < 0 ? 'color: #c0392b;' : '';
    
    const corFla = finalFla > 0 ? 'color: #27ae60;' : finalFla < 0 ? 'color: #c0392b;' : '';
    const corLucroFla = lucroFla > 0 ? 'color: #27ae60;' : lucroFla < 0 ? 'color: #c0392b;' : '';

    // NOVO FORMATO DE TEXTO COM SEPARAÇÃO VISUAL E CORES DINÂMICAS
    const detalheHTML = `
        <div style="font-family: var(--font-numbers) !important; font-size: 1.05rem; line-height: 1.6; color: #333;">
            
            Total de Vendas: <strong style="${corVendas}">${totalVendasBruto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><br>
            Total Taxas: <strong style="${corTaxas}">- ${totalTaxasPagamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><br>
            Total de Gastos: <strong style="${corGastos}">- ${totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><br><br>
            Lucro: <strong style="${corLucro}">${lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
            
            <div style="margin: 15px 0; border-top: 1px dashed rgba(0, 0, 0, 0.15);"></div>
            
            <strong>Divisão Detalhada:</strong><br><br>
            
            • Caixa: <strong style="${corCaixa}">${finalCaixa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><br><br>
            
            • Arabela: = <strong style="${corAra}">${finalAra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><br>
            &nbsp;&nbsp;&nbsp;⤷ Reembolso = <span style="${gAra > 0 ? 'color: #27ae60;' : ''}">${gAra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><br>
            &nbsp;&nbsp;&nbsp;⤷ Lucro = <span style="${corLucroAra}">${lucroAra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><br><br>
            
            • Flávio: = <strong style="${corFla}">${finalFla.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong><br>
            &nbsp;&nbsp;&nbsp;⤷ Reembolso = <span style="${gFla > 0 ? 'color: #27ae60;' : ''}">${gFla.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span><br>
            &nbsp;&nbsp;&nbsp;⤷ Lucro = <span style="${corLucroFla}">${lucroFla.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
        </div>
    `;

    document.getElementById('fechamento-divisao-detalhe').innerHTML = detalheHTML;

    // Salvar dados globais para envio no WhatsApp (adicionado os Lucros separados)
    window.dadosFechamentoWA = {
        totalVendido: totalVendasBruto,
        totalTaxas: totalTaxasPagamento,
        totalFaturamento: totalBase,
        totalGasto: totalGasto,
        lucroLiquido: lucroLiquido,
        gCaixa: gCaixa,
        gAra: gAra,
        gFla: gFla,
        gastosLancados: gastosLancados.total,
        gastosLancadosCaixa: gastosLancados.caixa,
        gastosLancadosAra: gastosLancados.arabela,
        gastosLancadosFla: gastosLancados.flavio,
        lucroAra: lucroAra,
        lucroFla: lucroFla,
        finalCaixa: finalCaixa,
        finalAra: finalAra,
        finalFla: finalFla,
        percCaixa: document.getElementById('perc-caixa').value,
        percAra: document.getElementById('perc-ara').value,
        percFla: document.getElementById('perc-fla').value
    };
};

window.enviarFechamentoWA = function(destinatario) {
    const normalizarDestinoWA = (valor) => String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const destinoNormalizado = normalizarDestinoWA(destinatario);

    const numerosFechamentoWA = {
        arabela: '558199502865',
        ara: '558199502865',
        flavio: '558199591775',
        fla: '558199591775',
        flávio: '558199591775'
    };

    const numeroDestinoWA = numerosFechamentoWA[destinoNormalizado];

    if (!numeroDestinoWA) {
        customAlert('Não foi possível identificar o número do destinatário do faturamento.', 'Atenção');
        return;
    }

    // Puxa o período e remove os parênteses limpinho
    const periodo = document.getElementById('fechamento-periodo').textContent.replace(/[()]/g, '').trim();

    const totalVendido = window.totalFechamentoVendasAtual ?? (window.totalFechamentoAtual || 0);
    const totalTaxas = window.totalTaxasPagamentoAtual || 0;
    const totalFaturamento = window.totalFechamentoAtual || 0;

    const gCaixa = parseFloat(document.getElementById('gasto-manual-caixa').value || 0);
    const gAra = parseFloat(document.getElementById('gasto-manual-ara').value || 0);
    const gFla = parseFloat(document.getElementById('gasto-manual-fla').value || 0);
    const totalGasto = gCaixa + gAra + gFla;
    const lucroLiquido = totalFaturamento - totalGasto;

    const pCaixa = parseFloat(document.getElementById('perc-caixa').value || 30) / 100;
    const pAra = parseFloat(document.getElementById('perc-ara').value || 35) / 100;
    const pFla = parseFloat(document.getElementById('perc-fla').value || 35) / 100;

    const lucroCaixa = lucroLiquido * pCaixa;
    const lucroAra = lucroLiquido * pAra;
    const lucroFla = lucroLiquido * pFla;

    const finalCaixa = lucroCaixa;
    const finalAra = lucroAra + gAra;
    const finalFla = lucroFla + gFla;

    const dados = {
        periodo, totalVendido, totalTaxas, totalFaturamento, totalGasto, lucroLiquido,
        gCaixa, gAra, gFla,
        finalCaixa, finalAra, finalFla,
        lucroAra, lucroFla
    };

    let txt = `*FAVU - Fechamento Financeiro*\n`;
    txt += `*Período:* ${dados.periodo}\n\n`;

    txt += `*Total de Vendas:* ${dados.totalVendido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    txt += `*Total Taxas:* - ${dados.totalTaxas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    txt += `*Faturamento:* ${dados.totalFaturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    txt += `*Total de Gastos:* - ${dados.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    txt += `*Lucro:* ${dados.lucroLiquido.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;
    txt += `*-------------------------------------*\n\n`;

    txt += `*Divisão Detalhada:*\n\n`;
    txt += `• Caixa: *${dados.finalCaixa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n\n`;

    txt += `• Arabela: = *${dados.finalAra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
    txt += `   ⤷ Reembolso = ${dados.gAra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    txt += `   ⤷ Lucro = ${dados.lucroAra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\n`;

    txt += `• Flávio: = *${dados.finalFla.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}*\n`;
    txt += `   ⤷ Reembolso = ${dados.gFla.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n`;
    txt += `   ⤷ Lucro = ${dados.lucroFla.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;

    window.open(`https://api.whatsapp.com/send?phone=${numeroDestinoWA}&text=${encodeURIComponent(txt)}`, '_blank');
};


// === GASTOS 2026-06-21: aba recriada no padrão visual das demais abas ===
window.gastosMesesPadrao = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

window.atualizarFiltroItensGastos = function(valorAtual = '') {
    const select = document.getElementById('gastos-filtro-item');
    if (!select) return;
    const atual = valorAtual || select.value || '';
    const itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    select.innerHTML = `<option value="">Todos os itens</option>` + itens.map(item => `<option value="${item.id}">${escapeHTMLGasto(item.nome || '')}</option>`).join('');
    if (atual && itens.some(item => item.id === atual)) select.value = atual;
};

window.copiarItemGasto = async function(itemId) {
    const item = getItemGasto(itemId);
    if (!item) return;

    const nomesUsados = new Set(allGastosItens.map(i => String(i.nome || '').trim().toLowerCase()));
    const baseNome = `${item.nome || 'Item'} (cópia)`;
    let novoNome = baseNome;
    let contador = 2;

    while (nomesUsados.has(novoNome.trim().toLowerCase())) {
        novoNome = `${baseNome} ${contador}`;
        contador++;
    }

    try {
        await addDoc(collection(db, 'gastos_itens'), {
            nome: novoNome,
            ordem: Date.now(),
            createdAt: Date.now()
        });
        window.showToast('Item copiado!');
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao copiar item.', true);
    }
};

window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;

    atualizarSelectAnoGastos();
    const ano = getAnoGastosSelecionado();
    const busca = normalizarBuscaGasto(document.getElementById('gastos-busca')?.value || '');
    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';
    const meses = window.gastosMesesPadrao;
    window.atualizarFiltroItensGastos(filtroItem);

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (filtroItem) itens = itens.filter(item => item.id === filtroItem);
    if (busca) itens = itens.filter(item => normalizarBuscaGasto(item.nome || '').includes(busca));

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="15" class="gastos-empty"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum item encontrado por aqui.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const totalGeral = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        const nomeSeguro = escapeHTMLGasto(item.nome || '');

        html += `<tr class="gastos-rebuild-row" data-gasto-item-row="${item.id}">
            <td>
                <div class="gastos-rebuild-item-main">
                    <strong class="gastos-rebuild-item-name">${nomeSeguro}</strong>
                    <span class="gastos-rebuild-item-hint">Clique em um mês para lançar/editar gastos</span>
                </div>
            </td>
            <td class="gastos-rebuild-total-cell">${formatarMoedaGasto(totalGeral)}</td>`;

        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            const ativo = gastosItemAberto === item.id && Number(gastosMesAberto) === mes ? ' active' : '';
            html += `<td class="gastos-rebuild-month-cell${ativo}" onclick="window.abrirGastosItem('${item.id}', ${mes})">
                <span class="gastos-rebuild-money">${formatarMoedaGasto(r.total || 0)}</span>
                <span class="gastos-rebuild-qty">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span>
            </td>`;
        }

        html += `<td>
            <div class="action-btns-wrapper gastos-rebuild-row-actions">
                <button class="btn-action edit" title="Editar item" onclick="window.renomearItemGasto('${item.id}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn-action copy" title="Copiar item" onclick="window.copiarItemGasto('${item.id}')"><i class="fas fa-copy"></i></button>
                <button class="btn-action del" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </td></tr>`;

        if (gastosItemAberto === item.id) {
            html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
        }
    });

    const totalAno = totaisMes.reduce((acc, v) => acc + v, 0);
    html += `<tr class="gastos-rebuild-total-row">
        <td>TOTAL MENSAL</td>
        <td><span>${formatarMoedaGasto(totalAno)}</span></td>`;
    for (let mes = 1; mes <= 12; mes++) html += `<td><span>${formatarMoedaGasto(totaisMes[mes] || 0)}</span></td>`;
    html += `<td></td></tr>`;

    body.innerHTML = html;
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';
    const totalMes = totalLancamentos(lista);
    const tabs = meses.map((m, idx) => `<button type="button" class="${idx + 1 === Number(mesAtivo) ? 'active' : ''}" onclick="window.abrirGastosItem('${item.id}', ${idx + 1})">${m}</button>`).join('');

    const tabelaLancamentos = lista.length ? `
        <table class="gastos-rebuild-lanc-table">
            <thead><tr>
                <th>Marca</th>
                <th>Kg/L</th>
                <th>Quantidade</th>
                <th>Unidade</th>
                <th>Total</th>
                <th>Comprador</th>
                <th>Data</th>
                <th>Ações</th>
            </tr></thead>
            <tbody>${lista.map(l => `
                <tr>
                    <td>${window.renderCampoMarcaListaGasto(l)}</td>
                    <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                    <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                    <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                    <td>
                        <div class="gastos-rebuild-lanc-actions">
                            <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                            <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                        </div>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>` : `<div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="15">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                    <div class="gastos-rebuild-drawer-total">Total do mês: ${formatarMoedaGasto(totalMes)}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-rebuild-month-tabs">${tabs}</div>

            <div class="gastos-rebuild-add-box">
                <div class="gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-lancamento-lista gastos-rebuild-form-list" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                    ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};




// === GASTOS 2026-06-21: ajustes finais solicitados ===
window.getGastosMarcasOcultas = function() {
    try {
        return new Set(JSON.parse(localStorage.getItem('favu_gastos_marcas_ocultas') || '[]'));
    } catch (e) {
        return new Set();
    }
};

window.setGastosMarcasOcultas = function(set) {
    try {
        localStorage.setItem('favu_gastos_marcas_ocultas', JSON.stringify([...set]));
    } catch (e) {}
};

window.marcasGastosDisponiveis = function() {
    const mapa = new Map();
    const ocultas = window.getGastosMarcasOcultas();

    (window.allGastosMarcas || []).forEach(m => {
        const nome = String(m.nome || m.marca || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !ocultas.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    allGastosLancamentos.forEach(l => {
        const nome = String(l.marca || l.nome || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !ocultas.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
};

window.excluirMarcaSelecionadaGasto = function(botao) {
    const wrap = botao.closest('.gasto-marca-select-wrap');
    const select = wrap?.querySelector('select');
    const valor = select?.value || '';
    if (!valor || valor === '__outros__') return window.showToast('Selecione uma marca cadastrada para excluir.', true);

    customConfirm(`Excluir a marca "${valor}" da lista de opções?`, async () => {
        const chave = window.normalizarMarcaGasto(valor);
        const ocultas = window.getGastosMarcasOcultas();
        ocultas.add(chave);
        window.setGastosMarcasOcultas(ocultas);

        try {
            const marcas = (window.allGastosMarcas || []).filter(m => window.normalizarMarcaGasto(m.nome || m.marca) === chave);
            await Promise.all(marcas.map(m => deleteDoc(doc(db, 'gastos_marcas', m.id)).catch(() => null)));
        } catch(e) {
            console.warn('Marca ocultada localmente, mas não foi possível apagar todos os registros:', e);
        }

        document.querySelectorAll('#t-gastos .gasto-lanc-marca-select, #t-gastos .gasto-list-marca-select').forEach(sel => {
            const atual = sel.value;
            sel.innerHTML = window.renderOptionsMarcaGasto(atual === valor ? '' : atual);
            if (atual === valor) sel.value = '';
        });

        window.showToast('Marca removida da lista de opções!');
    });
};

window.openGastoItemModal = function(itemId = '') {
    const item = itemId ? getItemGasto(itemId) : null;
    const idEl = document.getElementById('gasto-item-id');
    const nomeEl = document.getElementById('gasto-item-nome');
    const titleEl = document.getElementById('modal-gasto-item-title');

    if (idEl) idEl.value = itemId || '';
    if (nomeEl) nomeEl.value = item ? (item.nome || '') : '';
    if (titleEl) titleEl.textContent = item ? 'Editar Item' : 'Novo Item';

    window.openModal('modal-gasto-item');
    setTimeout(() => nomeEl?.focus(), 80);
};

window.adicionarItemGasto = function() {
    window.openGastoItemModal('');
};

window.renomearItemGasto = function(itemId) {
    window.openGastoItemModal(itemId);
};

window.salvarItemGastoModal = async function(event) {
    event.preventDefault();

    const itemId = document.getElementById('gasto-item-id')?.value || '';
    const nome = String(document.getElementById('gasto-item-nome')?.value || '').trim();

    if (!nome) return window.showToast('Informe o nome do item.', true);

    try {
        if (itemId) {
            await updateDoc(doc(db, 'gastos_itens', itemId), { nome, updatedAt: Date.now() });
            const vinculados = allGastosLancamentos.filter(l => l.itemId === itemId);
            await Promise.all(vinculados.map(l => updateDoc(doc(db, 'gastos_lancamentos', l.id), { itemNome: nome }).catch(() => null)));
            window.showToast('Item atualizado!');
        } else {
            await addDoc(collection(db, 'gastos_itens'), { nome, ordem: Date.now(), createdAt: Date.now() });
            window.showToast('Item criado!');
        }

        window.closeModal('modal-gasto-item', 'form-gasto-item');
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao salvar item.', true);
    }
};

window.limparFiltrosGastos = function() {
    const filtroItem = document.getElementById('gastos-filtro-item');
    if (filtroItem) filtroItem.value = '';
    const hj = new Date();
    window.gastosDataInicial = new Date(hj.getFullYear(), hj.getMonth(), 1, 0,0,0,0);
    window.gastosDataFinal = new Date(hj.getFullYear(), hj.getMonth() + 1, 0, 0,0,0,0);
    window.atualizarDisplayDataGastos?.();
    window.fecharGastosItem();
    window.renderGastosPlanilha();
};

window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;

    atualizarSelectAnoGastos();
    const ano = getAnoGastosSelecionado();
    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';
    const meses = window.gastosMesesPadrao || ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    window.atualizarFiltroItensGastos(filtroItem);

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (filtroItem) itens = itens.filter(item => item.id === filtroItem);
    if (gastosItemAberto) itens = itens.filter(item => item.id === gastosItemAberto);

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="15" class="gastos-empty"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum item encontrado por aqui.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let totalAnoGeral = 0;
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const totalGeral = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        totalAnoGeral += totalGeral;
        const nomeSeguro = escapeHTMLGasto(item.nome || '');

        html += `<tr class="gastos-rebuild-row" data-gasto-item-row="${item.id}">
            <td>
                <div class="gastos-rebuild-item-main">
                    <strong class="gastos-rebuild-item-name">${nomeSeguro}</strong>
                    <span class="gastos-rebuild-item-hint">Total no ano: ${formatarMoedaGasto(totalGeral)}</span>
                </div>
            </td>`;

        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            const ativo = gastosItemAberto === item.id && Number(gastosMesAberto) === mes ? ' active' : '';
            html += `<td class="gastos-rebuild-month-cell${ativo}" onclick="window.abrirGastosItem('${item.id}', ${mes})">
                <span class="gastos-rebuild-money">${formatarMoedaGasto(r.total || 0)}</span>
                <span class="gastos-rebuild-qty">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span>
            </td>`;
        }

        html += `<td class="gastos-rebuild-total-cell">${formatarMoedaGasto(totalGeral)}</td>
        <td>
            <div class="action-btns-wrapper gastos-rebuild-row-actions">
                <button class="btn-action edit" title="Editar item" onclick="window.renomearItemGasto('${item.id}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn-action copy" title="Copiar item" onclick="window.copiarItemGasto('${item.id}')"><i class="fas fa-copy"></i></button>
                <button class="btn-action del" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </td></tr>`;

        if (gastosItemAberto === item.id) {
            html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
        }
    });

    html += `<tr class="gastos-rebuild-total-row">
        <td>TOTAL MENSAL</td>`;
    for (let mes = 1; mes <= 12; mes++) html += `<td><span>${formatarMoedaGasto(totaisMes[mes] || 0)}</span></td>`;
    html += `<td><span>${formatarMoedaGasto(totalAnoGeral)}</span></td><td></td></tr>`;

    body.innerHTML = html;
};

window.abrirGastosItem = function(itemId, mes = null) {
    const mesNormalizado = Number(mes || gastosMesAberto || (new Date().getMonth() + 1));

    if (gastosItemAberto === itemId && Number(gastosMesAberto) === mesNormalizado) {
        gastosItemAberto = null;
        gastosMesAberto = mesNormalizado;
    } else {
        gastosItemAberto = itemId;
        gastosMesAberto = mesNormalizado;
    }

    const filtroItem = document.getElementById('gastos-filtro-item');
    if (filtroItem) filtroItem.value = '';

    window.renderGastosPlanilha();
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const tabelaLancamentos = lista.length ? `
        <div class="gastos-rebuild-lancados-box">
            <strong class="gastos-rebuild-subtitle">Itens lançados</strong>
            <table class="gastos-rebuild-lanc-table">
                <thead><tr>
                    <th>Marca</th>
                    <th>Kg/L</th>
                    <th>Quantidade</th>
                    <th>Unidade</th>
                    <th>Total</th>
                    <th>Comprador</th>
                    <th>Data</th>
                    <th>Ações</th>
                </tr></thead>
                <tbody>${lista.map(l => `
                    <tr>
                        <td>${window.renderCampoMarcaListaGasto(l)}</td>
                        <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                        <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                        <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                        <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                        <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                        <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                        <td>
                            <div class="gastos-rebuild-lanc-actions">
                                <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                                <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>` : `<div class="gastos-rebuild-lancados-box"><strong class="gastos-rebuild-subtitle">Itens lançados</strong><div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div></div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="15">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-rebuild-add-box">
                <div class="gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-lancamento-lista gastos-rebuild-form-list" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                    ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};




// === GASTOS 2026-06-21: Lançar itens e Itens lançados em formato de tabela limpa ===
window.criarLinhaLancamentoGastoHTML = function(dados = {}) {
    const id = dados.id || '';
    const marca = String(dados.marca || dados.nome || '').trim();
    const marcas = window.marcasGastosDisponiveis();
    const usarOutros = marca && !marcas.some(m => window.normalizarMarcaGasto(m) === window.normalizarMarcaGasto(marca));
    const qtd = dados.quantidade !== undefined && dados.quantidade !== null ? dados.quantidade : 1;
    const unit = dados.valorUnidade !== undefined && dados.valorUnidade !== null ? dados.valorUnidade : '';
    const total = dados.valorTotal !== undefined && dados.valorTotal !== null ? dados.valorTotal : ((Number(qtd) || 0) * (Number(unit) || 0));
    const comprador = dados.comprador || 'Caixa';
    const data = dados.dataCompra || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());

    return `<tr class="gasto-lanc-row">
        <td>
            <input type="hidden" class="gasto-lanc-id" value="${escapeHTMLGasto(id)}">
            <div class="gasto-marca-select-wrap">
                <select class="gasto-lanc-marca-select" onchange="window.toggleMarcaOutrosGasto(this)">
                    ${window.renderOptionsMarcaGasto(usarOutros ? '__outros__' : marca)}
                </select>
                <button type="button" class="gasto-marca-delete-btn" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada">×</button>
            </div>
            <input class="gasto-lanc-marca-outros" type="text" placeholder="Nova marca" value="${usarOutros ? escapeHTMLGasto(marca) : ''}" style="${usarOutros ? '' : 'display:none;'}">
        </td>
        <td><input class="gasto-lanc-peso" type="text" placeholder="Ex: 1kg ou 1L" value="${escapeHTMLGasto(dados.peso || '')}"></td>
        <td><input class="gasto-lanc-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(qtd)}" oninput="window.atualizarTotalLancamentoGasto(this)"></td>
        <td><input class="gasto-lanc-unit" type="number" min="0" step="0.01" placeholder="0,00" value="${escapeHTMLGasto(unit)}" oninput="window.atualizarTotalLancamentoGasto(this)"></td>
        <td><input class="gasto-lanc-total" type="number" min="0" step="0.01" placeholder="0,00" value="${Number(total || 0).toFixed(2)}" readonly></td>
        <td><select class="gasto-lanc-comprador"><option value="Caixa" ${comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
        <td><input class="gasto-lanc-data" type="date" value="${escapeHTMLGasto(data)}"></td>
        <td class="gastos-acoes-cell">
            <button class="gastos-icon-btn danger gastos-remover-linha" type="button" onclick="window.removerLinhaLancamentoGasto(this)" title="Remover linha"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`;
};

window.adicionarLinhaLancamentoGasto = function(itemId, dados = {}) {
    const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${itemId}"]`);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', window.criarLinhaLancamentoGastoHTML(dados));
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const tabelaLancamentos = lista.length ? `
        <div class="gastos-rebuild-lancados-box">
            <div class="gastos-rebuild-lancados-head">
                <strong class="gastos-rebuild-subtitle">Itens lançados</strong>
            </div>
            <div class="gastos-rebuild-lancados-table-wrap">
                <table class="gastos-rebuild-inner-table gastos-rebuild-lancados-table">
                    <thead><tr>
                        <th>Marca</th>
                        <th>Kg/L</th>
                        <th>Quantidade</th>
                        <th>Unidade</th>
                        <th>Total</th>
                        <th>Comprador</th>
                        <th>Data</th>
                        <th>Ações</th>
                    </tr></thead>
                    <tbody>${lista.map(l => `
                        <tr>
                            <td>${window.renderCampoMarcaListaGasto(l)}</td>
                            <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                            <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                            <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td class="gastos-acoes-cell">
                                <div class="gastos-rebuild-lanc-actions">
                                    <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                                    <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : `<div class="gastos-rebuild-lancados-box"><div class="gastos-rebuild-lancados-head"><strong class="gastos-rebuild-subtitle">Itens lançados</strong></div><div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div></div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="15">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-rebuild-add-box">
                <div class="gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-rebuild-lancar-table-wrap">
                    <table class="gastos-rebuild-inner-table gastos-rebuild-lancar-table">
                        <thead><tr>
                            <th>Marca</th>
                            <th>Kg/L</th>
                            <th>Quantidade</th>
                            <th>Unidade</th>
                            <th>Total</th>
                            <th>Comprador</th>
                            <th>Data</th>
                            <th>Ações</th>
                        </tr></thead>
                        <tbody class="gastos-lancamento-lista" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                            ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                        </tbody>
                    </table>
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};




// === GASTOS 2026-06-21: Lançar itens e Itens lançados em tabela real ===
window.criarLinhaLancamentoGastoHTML = function(dados = {}) {
    const id = dados.id || '';
    const marca = String(dados.marca || dados.nome || '').trim();
    const marcas = window.marcasGastosDisponiveis();
    const usarOutros = marca && !marcas.some(m => window.normalizarMarcaGasto(m) === window.normalizarMarcaGasto(marca));
    const qtd = dados.quantidade !== undefined && dados.quantidade !== null ? dados.quantidade : 1;
    const unit = dados.valorUnidade !== undefined && dados.valorUnidade !== null ? dados.valorUnidade : '';
    const total = dados.valorTotal !== undefined && dados.valorTotal !== null ? dados.valorTotal : ((Number(qtd) || 0) * (Number(unit) || 0));
    const comprador = dados.comprador || 'Caixa';
    const data = dados.dataCompra || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());

    return `<tr class="gasto-lanc-row">
        <td>
            <input type="hidden" class="gasto-lanc-id" value="${escapeHTMLGasto(id)}">
            <div class="gasto-marca-select-wrap">
                <select class="gasto-lanc-marca-select" onchange="window.toggleMarcaOutrosGasto(this)">
                    ${window.renderOptionsMarcaGasto(usarOutros ? '__outros__' : marca)}
                </select>
                <button type="button" class="gasto-marca-delete-btn" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada">×</button>
            </div>
            <input class="gasto-lanc-marca-outros" type="text" placeholder="Nova marca" value="${usarOutros ? escapeHTMLGasto(marca) : ''}" style="${usarOutros ? '' : 'display:none;'}">
        </td>
        <td><input class="gasto-lanc-peso" type="text" placeholder="Kg/L" value="${escapeHTMLGasto(dados.peso || '')}"></td>
        <td><input class="gasto-lanc-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(qtd)}" oninput="window.atualizarTotalLancamentoGasto(this)"></td>
        <td><input class="gasto-lanc-unit" type="number" min="0" step="0.01" placeholder="0,00" value="${escapeHTMLGasto(unit)}" oninput="window.atualizarTotalLancamentoGasto(this)"></td>
        <td><input class="gasto-lanc-total" type="number" min="0" step="0.01" placeholder="0,00" value="${Number(total || 0).toFixed(2)}" readonly></td>
        <td><select class="gasto-lanc-comprador"><option value="Caixa" ${comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
        <td><input class="gasto-lanc-data" type="date" value="${escapeHTMLGasto(data)}"></td>
        <td class="gastos-acoes-cell">
            <button class="gastos-icon-btn danger gastos-remover-linha" type="button" onclick="window.removerLinhaLancamentoGasto(this)" title="Remover linha"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`;
};

window.adicionarLinhaLancamentoGasto = function(itemId, dados = {}) {
    const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${itemId}"]`);
    if (!container) return;
    container.insertAdjacentHTML('beforeend', window.criarLinhaLancamentoGastoHTML(dados));
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const tabelaLancamentos = lista.length ? `
        <div class="gastos-rebuild-lancados-box">
            <div class="gastos-rebuild-lancados-head">
                <strong class="gastos-rebuild-subtitle">Itens lançados</strong>
            </div>
            <div class="gastos-rebuild-lancados-table-wrap">
                <table class="gastos-rebuild-inner-table gastos-rebuild-lancados-table">
                    <thead><tr>
                        <th>Marca</th>
                        <th>Kg/L</th>
                        <th>Quantidade</th>
                        <th>Unidade</th>
                        <th>Total</th>
                        <th>Comprador</th>
                        <th>Data</th>
                        <th>Ações</th>
                    </tr></thead>
                    <tbody>${lista.map(l => `
                        <tr>
                            <td>${window.renderCampoMarcaListaGasto(l)}</td>
                            <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                            <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                            <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td class="gastos-acoes-cell">
                                <div class="gastos-rebuild-lanc-actions">
                                    <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                                    <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : `<div class="gastos-rebuild-lancados-box"><div class="gastos-rebuild-lancados-head"><strong class="gastos-rebuild-subtitle">Itens lançados</strong></div><div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div></div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="15">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-rebuild-add-box">
                <div class="gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-rebuild-lancar-table-wrap">
                    <table class="gastos-rebuild-inner-table gastos-rebuild-lancar-table">
                        <thead><tr>
                            <th>Marca</th>
                            <th>Kg/L</th>
                            <th>Quantidade</th>
                            <th>Unidade</th>
                            <th>Total</th>
                            <th>Comprador</th>
                            <th>Data</th>
                            <th>Ações</th>
                        </tr></thead>
                        <tbody class="gastos-lancamento-lista" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                            ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                        </tbody>
                    </table>
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};




// === GASTOS 2026-06-21: Lançar itens exatamente no mesmo layout de Itens lançados ===
window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const cabecalhoTabela = `
        <thead><tr>
            <th>Marca</th>
            <th>Kg/L</th>
            <th>Quantidade</th>
            <th>Unidade</th>
            <th>Total</th>
            <th>Comprador</th>
            <th>Data</th>
            <th>Ações</th>
        </tr></thead>`;

    const tabelaLancamentos = lista.length ? `
        <div class="gastos-section-box gastos-rebuild-lancados-box">
            <div class="gastos-section-head gastos-rebuild-lancados-head">
                <strong class="gastos-rebuild-subtitle">Itens lançados</strong>
            </div>
            <div class="gastos-section-table-wrap gastos-rebuild-lancados-table-wrap">
                <table class="gastos-section-table gastos-rebuild-inner-table gastos-rebuild-lancados-table">
                    ${cabecalhoTabela}
                    <tbody>${lista.map(l => `
                        <tr>
                            <td>${window.renderCampoMarcaListaGasto(l)}</td>
                            <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                            <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                            <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td class="gastos-acoes-cell">
                                <div class="gastos-rebuild-lanc-actions">
                                    <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                                    <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : `<div class="gastos-section-box gastos-rebuild-lancados-box"><div class="gastos-section-head gastos-rebuild-lancados-head"><strong class="gastos-rebuild-subtitle">Itens lançados</strong></div><div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div></div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="15">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-section-box gastos-rebuild-add-box">
                <div class="gastos-section-head gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-section-table-wrap gastos-rebuild-lancar-table-wrap">
                    <table class="gastos-section-table gastos-rebuild-inner-table gastos-rebuild-lancar-table">
                        ${cabecalhoTabela}
                        <tbody class="gastos-lancamento-lista" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                            ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                        </tbody>
                    </table>
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};




// === GASTOS 2026-06-21: remover coluna Total no ano e exibir unidades no item ===
window.calcularTotalUnidadesGastoItem = function(resumo) {
    return Object.values(resumo || {}).reduce((acc, r) => acc + (Number(r?.qtd) || 0), 0);
};

window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;

    atualizarSelectAnoGastos();
    const ano = getAnoGastosSelecionado();
    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';
    const meses = window.gastosMesesPadrao || ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    window.atualizarFiltroItensGastos(filtroItem);

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (filtroItem) itens = itens.filter(item => item.id === filtroItem);
    if (gastosItemAberto) itens = itens.filter(item => item.id === gastosItemAberto);

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="14" class="gastos-empty"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum item encontrado por aqui.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const valorTotalAno = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        const totalUnidadesAno = window.calcularTotalUnidadesGastoItem(resumo);
        const nomeSeguro = escapeHTMLGasto(item.nome || '');

        html += `<tr class="gastos-rebuild-row" data-gasto-item-row="${item.id}">
            <td>
                <div class="gastos-rebuild-item-main">
                    <strong class="gastos-rebuild-item-name">${nomeSeguro}</strong>
                    <span class="gastos-rebuild-item-total-line">Valor total: ${formatarMoedaGasto(valorTotalAno)}</span>
                    <span class="gastos-rebuild-item-units-line">Total de unidades: ${totalUnidadesAno.toLocaleString('pt-BR')} un.</span>
                </div>
            </td>`;

        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            const ativo = gastosItemAberto === item.id && Number(gastosMesAberto) === mes ? ' active' : '';
            html += `<td class="gastos-rebuild-month-cell${ativo}" onclick="window.abrirGastosItem('${item.id}', ${mes})">
                <span class="gastos-rebuild-money">${formatarMoedaGasto(r.total || 0)}</span>
                <span class="gastos-rebuild-qty">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span>
            </td>`;
        }

        html += `<td>
            <div class="action-btns-wrapper gastos-rebuild-row-actions">
                <button class="btn-action edit" title="Editar item" onclick="window.renomearItemGasto('${item.id}')"><i class="fas fa-pencil-alt"></i></button>
                <button class="btn-action copy" title="Copiar item" onclick="window.copiarItemGasto('${item.id}')"><i class="fas fa-copy"></i></button>
                <button class="btn-action del" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </td></tr>`;

        if (gastosItemAberto === item.id) {
            html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
        }
    });

    html += `<tr class="gastos-rebuild-total-row">
        <td>TOTAL MENSAL</td>`;
    for (let mes = 1; mes <= 12; mes++) html += `<td><span>${formatarMoedaGasto(totaisMes[mes] || 0)}</span></td>`;
    html += `<td></td></tr>`;

    body.innerHTML = html;
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const cabecalhoTabela = `
        <thead><tr>
            <th>Marca</th>
            <th>Kg/L</th>
            <th>Quantidade</th>
            <th>Unidade</th>
            <th>Total</th>
            <th>Comprador</th>
            <th>Data</th>
            <th>Ações</th>
        </tr></thead>`;

    const tabelaLancamentos = lista.length ? `
        <div class="gastos-section-box gastos-rebuild-lancados-box">
            <div class="gastos-section-head gastos-rebuild-lancados-head">
                <strong class="gastos-rebuild-subtitle">Itens lançados</strong>
            </div>
            <div class="gastos-section-table-wrap gastos-rebuild-lancados-table-wrap">
                <table class="gastos-section-table gastos-rebuild-inner-table gastos-rebuild-lancados-table">
                    ${cabecalhoTabela}
                    <tbody>${lista.map(l => `
                        <tr>
                            <td>${window.renderCampoMarcaListaGasto(l)}</td>
                            <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                            <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                            <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td class="gastos-acoes-cell">
                                <div class="gastos-rebuild-lanc-actions">
                                    <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                                    <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : `<div class="gastos-section-box gastos-rebuild-lancados-box"><div class="gastos-section-head gastos-rebuild-lancados-head"><strong class="gastos-rebuild-subtitle">Itens lançados</strong></div><div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div></div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="14">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-section-box gastos-rebuild-add-box">
                <div class="gastos-section-head gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-section-table-wrap gastos-rebuild-lancar-table-wrap">
                    <table class="gastos-section-table gastos-rebuild-inner-table gastos-rebuild-lancar-table">
                        ${cabecalhoTabela}
                        <tbody class="gastos-lancamento-lista" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                            ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                        </tbody>
                    </table>
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};




// === GASTOS 2026-06-21: edição direta do nome do item, sem botão editar ===
window.renomearCategoriaGastoInline = async function(input, itemId) {
    const item = getItemGasto(itemId);
    if (!item || !input) return;

    const novo = String(input.value || '').trim();
    if (!novo) {
        input.value = item.nome || '';
        return window.showToast('Informe um nome para o item.', true);
    }

    if (novo === (item.nome || '')) return;

    try {
        await updateDoc(doc(db, 'gastos_itens', itemId), { nome: novo, updatedAt: Date.now() });
        const vinculados = allGastosLancamentos.filter(l => l.itemId === itemId);
        await Promise.all(vinculados.map(l => updateDoc(doc(db, 'gastos_lancamentos', l.id), { itemNome: novo }).catch(() => null)));
        window.showToast('Item atualizado!');
    } catch(e) {
        console.error(e);
        input.value = item.nome || '';
        window.showToast('Erro ao atualizar item.', true);
    }
};

window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;

    atualizarSelectAnoGastos();
    const ano = getAnoGastosSelecionado();
    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';
    const meses = window.gastosMesesPadrao || ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    window.atualizarFiltroItensGastos(filtroItem);

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (filtroItem) itens = itens.filter(item => item.id === filtroItem);
    if (gastosItemAberto) itens = itens.filter(item => item.id === gastosItemAberto);

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="14" class="gastos-empty"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum item encontrado por aqui.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const valorTotalAno = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        const totalUnidadesAno = window.calcularTotalUnidadesGastoItem ? window.calcularTotalUnidadesGastoItem(resumo) : Object.values(resumo).reduce((acc, r) => acc + (Number(r?.qtd) || 0), 0);
        const nomeSeguro = escapeHTMLGasto(item.nome || '');

        html += `<tr class="gastos-rebuild-row" data-gasto-item-row="${item.id}">
            <td>
                <div class="gastos-rebuild-item-main">
                    <input class="gastos-item-nome-inline" value="${nomeSeguro}" 
                        title="Clique para alterar o nome"
                        onblur="window.renomearCategoriaGastoInline(this, '${item.id}')"
                        onkeydown="if(event.key === 'Enter'){this.blur();}">
                    <span class="gastos-rebuild-item-total-line">Valor total: ${formatarMoedaGasto(valorTotalAno)}</span>
                    <span class="gastos-rebuild-item-units-line">Total de unidades: ${totalUnidadesAno.toLocaleString('pt-BR')} un.</span>
                </div>
            </td>`;

        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            const ativo = gastosItemAberto === item.id && Number(gastosMesAberto) === mes ? ' active' : '';
            html += `<td class="gastos-rebuild-month-cell${ativo}" onclick="window.abrirGastosItem('${item.id}', ${mes})">
                <span class="gastos-rebuild-money">${formatarMoedaGasto(r.total || 0)}</span>
                <span class="gastos-rebuild-qty">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span>
            </td>`;
        }

        html += `<td>
            <div class="action-btns-wrapper gastos-rebuild-row-actions">
                <button class="btn-action copy" title="Copiar item" onclick="window.copiarItemGasto('${item.id}')"><i class="fas fa-copy"></i></button>
                <button class="btn-action del" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </td></tr>`;

        if (gastosItemAberto === item.id) {
            html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
        }
    });

    html += `<tr class="gastos-rebuild-total-row">
        <td>TOTAL MENSAL</td>`;
    for (let mes = 1; mes <= 12; mes++) html += `<td><span>${formatarMoedaGasto(totaisMes[mes] || 0)}</span></td>`;
    html += `<td></td></tr>`;

    body.innerHTML = html;
};




// === GASTOS 2026-06-21: total anual geral na coluna Ações ===
window.renderGastosPlanilha = function() {
    const body = document.getElementById('gastos-planilha-body');
    if (!body) return;

    atualizarSelectAnoGastos();
    const ano = getAnoGastosSelecionado();
    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';
    const meses = window.gastosMesesPadrao || ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    window.atualizarFiltroItensGastos(filtroItem);

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (filtroItem) itens = itens.filter(item => item.id === filtroItem);
    if (gastosItemAberto) itens = itens.filter(item => item.id === gastosItemAberto);

    if (!itens.length) {
        body.innerHTML = `<tr><td colspan="14" class="gastos-empty"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum item encontrado por aqui.</td></tr>`;
        return;
    }

    const totaisMes = Array(13).fill(0);
    let totalAnoGeral = 0;
    let html = '';

    itens.forEach(item => {
        const resumo = calcularResumoGastosItem(item, ano);
        const valorTotalAno = Object.values(resumo).reduce((acc, r) => acc + r.total, 0);
        const totalUnidadesAno = window.calcularTotalUnidadesGastoItem ? window.calcularTotalUnidadesGastoItem(resumo) : Object.values(resumo).reduce((acc, r) => acc + (Number(r?.qtd) || 0), 0);
        totalAnoGeral += valorTotalAno;
        const nomeSeguro = escapeHTMLGasto(item.nome || '');

        html += `<tr class="gastos-rebuild-row" data-gasto-item-row="${item.id}">
            <td data-label="Item:">
                <div class="gastos-rebuild-item-main">
                    <input class="gastos-item-nome-inline" value="${nomeSeguro}"
                        title="Clique para alterar o nome"
                        onblur="window.renomearCategoriaGastoInline(this, '${item.id}')"
                        onkeydown="if(event.key === 'Enter'){this.blur();}">
                    <span class="gastos-rebuild-item-total-line">Valor total: ${formatarMoedaGasto(valorTotalAno)}</span>
                    <span class="gastos-rebuild-item-units-line">Total de unidades: ${totalUnidadesAno.toLocaleString('pt-BR')} un.</span>
                </div>
            </td>`;

        for (let mes = 1; mes <= 12; mes++) {
            const r = resumo[mes];
            totaisMes[mes] += r.total;
            const ativo = gastosItemAberto === item.id && Number(gastosMesAberto) === mes ? ' active' : '';
            html += `<td class="gastos-rebuild-month-cell${ativo}" data-label="${meses[mes - 1]}:" onclick="window.abrirLancamentosDoMes('${item.id}', ${mes})">
                <span class="gastos-rebuild-money">${formatarMoedaGasto(r.total || 0)}</span>
                <span class="gastos-rebuild-qty">${r.qtd ? `${r.qtd.toLocaleString('pt-BR')} un.` : '0 un.'}</span>
            </td>`;
        }

        html += `<td data-label="Ações:">
            <div class="action-btns-wrapper gastos-rebuild-row-actions">
                <button class="btn-action copy" title="Copiar item" onclick="window.copiarItemGasto('${item.id}')"><i class="fas fa-copy"></i></button>
                <button class="btn-action del" title="Excluir item" onclick="window.excluirItemGasto('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </td></tr>`;

        if (gastosItemAberto === item.id) {
            html += window.renderGastosDrawer(item, gastosMesAberto || new Date().getMonth() + 1, ano, meses);
        }
    });

    html += `<tr class="gastos-rebuild-total-row">
        <td data-label="">TOTAL MENSAL</td>`;
    // CORREÇÃO (achado ao testar em celular real): estas células de mês não tinham a classe
    // "gastos-rebuild-month-cell" que as células de mês das linhas de item têm. No celular,
    // o CSS usa essa classe pra esconder os 11 meses que não são o mês filtrado - sem ela,
    // esta linha de total sempre mostrava os 12 meses inteiros, espremidos. Adicionando a
    // mesma classe aqui, a linha de total passa a respeitar o filtro de mês igual às outras.
    for (let mes = 1; mes <= 12; mes++) html += `<td class="gastos-rebuild-month-cell" data-label="${meses[mes - 1]}:"><span>${formatarMoedaGasto(totaisMes[mes] || 0)}</span></td>`;
    html += `<td data-label="Total anual:">
        <div class="gastos-total-anual-geral">
            <small>TOTAL ANUAL</small>
            <strong>${formatarMoedaGasto(totalAnoGeral || 0)}</strong>
        </div>
    </td></tr>`;

    body.innerHTML = html;
};




// === GASTOS 2026-06-21: marcas cadastráveis pelo Outros e exclusão confirmada ===
window.getGastosMarcasOcultas = function() {
    try {
        return new Set(JSON.parse(localStorage.getItem('favu_gastos_marcas_ocultas') || '[]'));
    } catch (e) {
        return new Set();
    }
};

window.setGastosMarcasOcultas = function(set) {
    try {
        localStorage.setItem('favu_gastos_marcas_ocultas', JSON.stringify([...set]));
    } catch (e) {}
};

window.normalizarMarcaGasto = window.normalizarMarcaGasto || function(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

window.marcaGastoEstaCadastrada = function(valor) {
    const chave = window.normalizarMarcaGasto(valor);
    if (!chave) return false;
    return window.marcasGastosDisponiveis().some(m => window.normalizarMarcaGasto(m) === chave);
};

window.marcasGastosDisponiveis = function() {
    const mapa = new Map();
    const ocultas = window.getGastosMarcasOcultas();

    (window.allGastosMarcas || []).forEach(m => {
        const nome = String(m.nome || m.marca || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !ocultas.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    allGastosLancamentos.forEach(l => {
        const nome = String(l.marca || l.nome || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !ocultas.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
};

window.renderOptionsMarcaGasto = function(marcaSelecionada = '') {
    const marcas = window.marcasGastosDisponiveis();
    const marcaAtual = String(marcaSelecionada || '').trim();
    const chaveAtual = window.normalizarMarcaGasto(marcaAtual);
    const existe = marcas.some(m => window.normalizarMarcaGasto(m) === chaveAtual);

    let html = `<option value="">Selecione...</option>`;
    marcas.forEach(m => {
        const selected = window.normalizarMarcaGasto(m) === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(m)}" ${selected}>${escapeHTMLGasto(m)}</option>`;
    });
    html += `<option value="__outros__" ${marcaAtual && !existe ? 'selected' : ''}>Outros</option>`;
    return html;
};

window.atualizarBotaoExcluirMarcaGasto = function(select) {
    const wrap = select?.closest?.('.gasto-marca-select-wrap');
    const btn = wrap?.querySelector?.('.gasto-marca-delete-btn');
    if (!wrap || !btn) return;

    const valor = String(select.value || '').trim();
    const cadastrado = valor && valor !== '__outros__' && window.marcaGastoEstaCadastrada(valor);

    wrap.classList.toggle('has-registered-brand', !!cadastrado);
    btn.classList.toggle('visible', !!cadastrado);
    btn.style.display = cadastrado ? 'inline-flex' : 'none';
};

window.atualizarBotoesExcluirMarcaGasto = function(scope = document) {
    (scope || document).querySelectorAll('#t-gastos .gasto-lanc-marca-select, #t-gastos .gasto-list-marca-select, .gasto-lote-marca-select, #edit-lanc-marca').forEach(sel => {
        window.atualizarBotaoExcluirMarcaGasto(sel);
    });
};

window.toggleMarcaOutrosGasto = function(select) {
    const row = select.closest('.gasto-lanc-row, tr');
    const inputOutros = row?.querySelector('.gasto-lanc-marca-outros, .gasto-list-marca-outros');

    if (inputOutros) {
        inputOutros.style.display = select.value === '__outros__' ? '' : 'none';
        if (select.value === '__outros__') inputOutros.focus();
    }

    window.atualizarBotaoExcluirMarcaGasto(select);
};

window.garantirMarcaGasto = async function(marca) {
    const nome = String(marca || '').trim();
    if (!nome) return;

    const chave = window.normalizarMarcaGasto(nome);

    const ocultas = window.getGastosMarcasOcultas();
    if (ocultas.has(chave)) {
        ocultas.delete(chave);
        window.setGastosMarcasOcultas(ocultas);
    }

    const existente = (window.allGastosMarcas || []).find(m => window.normalizarMarcaGasto(m.nome || m.marca) === chave);
    if (existente) return;

    try {
        const ref = await addDoc(collection(db, 'gastos_marcas'), { nome, createdAt: Date.now() });
        window.allGastosMarcas = window.allGastosMarcas || [];
        window.allGastosMarcas.push({ id: ref.id, nome, createdAt: Date.now() });
    } catch(e) {
        console.warn('Não foi possível salvar marca nova:', e);
    }
};

window.atualizarSelectsMarcaGasto = function() {
    document.querySelectorAll('#t-gastos .gasto-lanc-marca-select, #t-gastos .gasto-list-marca-select, .gasto-lote-marca-select, #edit-lanc-marca').forEach(sel => {
        const atual = sel.value;
        sel.innerHTML = window.renderOptionsMarcaGasto(atual);
        if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
        window.atualizarBotaoExcluirMarcaGasto(sel);
    });
};

window.excluirMarcaSelecionadaGasto = function(botao) {
    const wrap = botao.closest('.gasto-marca-select-wrap');
    const select = wrap?.querySelector('select');
    const valor = String(select?.value || '').trim();

    if (!valor || valor === '__outros__' || !window.marcaGastoEstaCadastrada(valor)) {
        return window.showToast('Selecione uma marca cadastrada para excluir.', true);
    }

    customConfirm(`Excluir a marca "${valor}" da lista de opções?`, async () => {
        const chave = window.normalizarMarcaGasto(valor);
        const ocultas = window.getGastosMarcasOcultas();
        ocultas.add(chave);
        window.setGastosMarcasOcultas(ocultas);

        try {
            const marcas = (window.allGastosMarcas || []).filter(m => window.normalizarMarcaGasto(m.nome || m.marca) === chave);
            await Promise.all(marcas
                .filter(m => m.id && !String(m.id).startsWith('local-'))
                .map(m => deleteDoc(doc(db, 'gastos_marcas', m.id)).catch(() => null)));
            window.allGastosMarcas = (window.allGastosMarcas || []).filter(m => window.normalizarMarcaGasto(m.nome || m.marca) !== chave);
        } catch(e) {
            console.warn('Marca ocultada da lista, mas não foi possível apagar todos os registros:', e);
        }

        document.querySelectorAll('#t-gastos .gasto-lanc-marca-select, #t-gastos .gasto-list-marca-select, .gasto-lote-marca-select, #edit-lanc-marca').forEach(sel => {
            if (window.normalizarMarcaGasto(sel.value) === chave) sel.value = '';
            sel.innerHTML = window.renderOptionsMarcaGasto(sel.value);
            window.toggleMarcaOutrosGasto(sel);
        });

        window.showToast('Marca removida da lista de opções!');
    });
};

window.getMarcaDaLinhaGasto = function(row, seletorSelect = '.gasto-lanc-marca-select', seletorOutros = '.gasto-lanc-marca-outros') {
    const select = row.querySelector(seletorSelect);
    if (!select) return '';
    if (select.value === '__outros__') return String(row.querySelector(seletorOutros)?.value || '').trim();
    return String(select.value || '').trim();
};

window.renderCampoMarcaListaGasto = function(l) {
    const marca = String(l.marca || l.nome || '').trim();
    const marcas = window.marcasGastosDisponiveis();
    const usarOutros = marca && !marcas.some(m => window.normalizarMarcaGasto(m) === window.normalizarMarcaGasto(marca));
    const mostrarExcluir = marca && !usarOutros && window.marcaGastoEstaCadastrada(marca);

    return `<div class="gasto-marca-select-wrap ${mostrarExcluir ? 'has-registered-brand' : ''}">
        <select class="gasto-list-marca-select" onchange="window.toggleMarcaOutrosGasto(this); window.salvarCampoLancamentoGasto('${l.id}', this)">
            ${window.renderOptionsMarcaGasto(usarOutros ? '__outros__' : marca)}
        </select>
        <button type="button" class="gasto-marca-delete-btn ${mostrarExcluir ? 'visible' : ''}" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada">×</button>
    </div>
    <input class="gasto-list-marca-outros" value="${usarOutros ? escapeHTMLGasto(marca) : ''}" placeholder="Nova marca" style="${usarOutros ? '' : 'display:none;'}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)">`;
};

const renderGastosPlanilhaMarcasOriginal = window.renderGastosPlanilha;
window.renderGastosPlanilha = function(...args) {
    const retorno = renderGastosPlanilhaMarcasOriginal.apply(this, args);
    setTimeout(() => window.atualizarBotoesExcluirMarcaGasto(document), 80);
    return retorno;
};

const adicionarLinhaLancamentoGastoMarcasOriginal = window.adicionarLinhaLancamentoGasto;
window.adicionarLinhaLancamentoGasto = function(...args) {
    const retorno = adicionarLinhaLancamentoGastoMarcasOriginal.apply(this, args);
    setTimeout(() => window.atualizarBotoesExcluirMarcaGasto(document), 50);
    return retorno;
};




// === GASTOS 2026-06-21: Local nos lançamentos ===
window.allGastosLocais = window.allGastosLocais || [];

window.getGastosLocaisOcultos = function() {
    try {
        return new Set(JSON.parse(localStorage.getItem('favu_gastos_locais_ocultos') || '[]'));
    } catch (e) {
        return new Set();
    }
};

window.setGastosLocaisOcultos = function(set) {
    try {
        localStorage.setItem('favu_gastos_locais_ocultos', JSON.stringify([...set]));
    } catch (e) {}
};

window.normalizarLocalGasto = function(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

window.locaisGastosDisponiveis = function() {
    const mapa = new Map();
    const ocultos = window.getGastosLocaisOcultos();

    (window.allGastosLocais || []).forEach(l => {
        const nome = String(l.nome || l.local || l.localCompra || '').trim();
        const chave = window.normalizarLocalGasto(nome);
        if (nome && !ocultos.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    (allGastosLancamentos || []).forEach(l => {
        const nome = String(l.localCompra || l.local || '').trim();
        const chave = window.normalizarLocalGasto(nome);
        if (nome && !ocultos.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    return [...mapa.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
};

window.localGastoEstaCadastrado = function(valor) {
    const chave = window.normalizarLocalGasto(valor);
    if (!chave) return false;
    return window.locaisGastosDisponiveis().some(l => window.normalizarLocalGasto(l) === chave);
};

window.renderOptionsLocalGasto = function(localSelecionado = '') {
    const locais = window.locaisGastosDisponiveis();
    const atual = String(localSelecionado || '').trim();
    const chaveAtual = window.normalizarLocalGasto(atual);
    const existe = locais.some(l => window.normalizarLocalGasto(l) === chaveAtual);

    let html = `<option value="">Selecione...</option>`;
    locais.forEach(l => {
        const selected = window.normalizarLocalGasto(l) === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(l)}" ${selected}>${escapeHTMLGasto(l)}</option>`;
    });
    html += `<option value="__outros__" ${atual && !existe ? 'selected' : ''}>Outros</option>`;
    return html;
};

window.atualizarBotaoExcluirLocalGasto = function(select) {
    const wrap = select?.closest?.('.gasto-local-select-wrap');
    const btn = wrap?.querySelector?.('.gasto-local-delete-btn');
    if (!wrap || !btn) return;

    const valor = String(select.value || '').trim();
    const cadastrado = valor && valor !== '__outros__' && window.localGastoEstaCadastrado(valor);

    wrap.classList.toggle('has-registered-local', !!cadastrado);
    btn.classList.toggle('visible', !!cadastrado);
    btn.style.display = cadastrado ? 'inline-flex' : 'none';
};

window.toggleLocalOutrosGasto = function(select) {
    const row = select.closest('.gasto-lanc-row, tr');
    const inputOutros = row?.querySelector('.gasto-lanc-local-outros, .gasto-list-local-outros');

    if (inputOutros) {
        inputOutros.style.display = select.value === '__outros__' ? '' : 'none';
        if (select.value === '__outros__') inputOutros.focus();
    }

    window.atualizarBotaoExcluirLocalGasto(select);
};

window.getLocalDaLinhaGasto = function(row, seletorSelect = '.gasto-lanc-local-select', seletorOutros = '.gasto-lanc-local-outros') {
    const select = row.querySelector(seletorSelect);
    if (!select) return '';
    if (select.value === '__outros__') return String(row.querySelector(seletorOutros)?.value || '').trim();
    return String(select.value || '').trim();
};

window.garantirLocalGasto = async function(local) {
    const nome = String(local || '').trim();
    if (!nome) return;

    const chave = window.normalizarLocalGasto(nome);

    const ocultos = window.getGastosLocaisOcultos();
    if (ocultos.has(chave)) {
        ocultos.delete(chave);
        window.setGastosLocaisOcultos(ocultos);
    }

    const existente = (window.allGastosLocais || []).find(l => window.normalizarLocalGasto(l.nome || l.local || l.localCompra) === chave);
    if (existente) return;

    try {
        const ref = await addDoc(collection(db, 'gastos_locais'), { nome, createdAt: Date.now() });
        window.allGastosLocais = window.allGastosLocais || [];
        window.allGastosLocais.push({ id: ref.id, nome, createdAt: Date.now() });
    } catch(e) {
        console.warn('Não foi possível salvar local novo:', e);
    }
};

window.excluirLocalSelecionadoGasto = function(botao) {
    const wrap = botao.closest('.gasto-local-select-wrap');
    const select = wrap?.querySelector('select');
    const valor = String(select?.value || '').trim();

    if (!valor || valor === '__outros__' || !window.localGastoEstaCadastrado(valor)) {
        return window.showToast('Selecione um local cadastrado para excluir.', true);
    }

    customConfirm(`Excluir o local "${valor}" da lista de opções?`, async () => {
        const chave = window.normalizarLocalGasto(valor);
        const ocultos = window.getGastosLocaisOcultos();
        ocultos.add(chave);
        window.setGastosLocaisOcultos(ocultos);

        try {
            const locais = (window.allGastosLocais || []).filter(l => window.normalizarLocalGasto(l.nome || l.local || l.localCompra) === chave);
            await Promise.all(locais
                .filter(l => l.id && !String(l.id).startsWith('local-'))
                .map(l => deleteDoc(doc(db, 'gastos_locais', l.id)).catch(() => null)));
            window.allGastosLocais = (window.allGastosLocais || []).filter(l => window.normalizarLocalGasto(l.nome || l.local || l.localCompra) !== chave);
        } catch(e) {
            console.warn('Local ocultado da lista, mas não foi possível apagar todos os registros:', e);
        }

        document.querySelectorAll('#t-gastos .gasto-lanc-local-select, #t-gastos .gasto-list-local-select, .gasto-lote-local-select, #edit-lanc-local, #gasto-lote-local-unico').forEach(sel => {
            if (window.normalizarLocalGasto(sel.value) === chave) sel.value = '';
            sel.innerHTML = window.renderOptionsLocalGasto(sel.value);
            window.toggleLocalOutrosGasto(sel);
        });

        window.showToast('Local removido da lista de opções!');
    });
};

window.renderCampoLocalListaGasto = function(l) {
    const local = String(l.localCompra || l.local || '').trim();
    const locais = window.locaisGastosDisponiveis();
    const usarOutros = local && !locais.some(x => window.normalizarLocalGasto(x) === window.normalizarLocalGasto(local));
    const mostrarExcluir = local && !usarOutros && window.localGastoEstaCadastrado(local);

    return `<div class="gasto-local-select-wrap ${mostrarExcluir ? 'has-registered-local' : ''}">
        <select class="gasto-list-local-select" onchange="window.toggleLocalOutrosGasto(this); window.salvarCampoLancamentoGasto('${l.id}', this)">
            ${window.renderOptionsLocalGasto(usarOutros ? '__outros__' : local)}
        </select>
        <button type="button" class="gasto-local-delete-btn ${mostrarExcluir ? 'visible' : ''}" onclick="window.excluirLocalSelecionadoGasto(this)" title="Excluir local selecionado">×</button>
    </div>
    <input class="gasto-list-local-outros" value="${usarOutros ? escapeHTMLGasto(local) : ''}" placeholder="Novo local" style="${usarOutros ? '' : 'display:none;'}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)">`;
};

window.criarLinhaLancamentoGastoHTML = function(dados = {}) {
    const id = dados.id || '';
    const marca = String(dados.marca || dados.nome || '').trim();
    const local = String(dados.localCompra || dados.local || '').trim();

    const marcas = window.marcasGastosDisponiveis();
    const usarOutrosMarca = marca && !marcas.some(m => window.normalizarMarcaGasto(m) === window.normalizarMarcaGasto(marca));
    const mostrarExcluirMarca = marca && !usarOutrosMarca && window.marcaGastoEstaCadastrada?.(marca);

    const locais = window.locaisGastosDisponiveis();
    const usarOutrosLocal = local && !locais.some(l => window.normalizarLocalGasto(l) === window.normalizarLocalGasto(local));
    const mostrarExcluirLocal = local && !usarOutrosLocal && window.localGastoEstaCadastrado(local);

    const qtd = dados.quantidade !== undefined && dados.quantidade !== null ? dados.quantidade : 1;
    const unit = dados.valorUnidade !== undefined && dados.valorUnidade !== null ? dados.valorUnidade : '';
    const total = dados.valorTotal !== undefined && dados.valorTotal !== null ? dados.valorTotal : ((Number(qtd) || 0) * (Number(unit) || 0));
    const comprador = dados.comprador || 'Caixa';
    const data = dados.dataCompra || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());

    return `<tr class="gasto-lanc-row">
        <td>
            <input type="hidden" class="gasto-lanc-id" value="${escapeHTMLGasto(id)}">
            <div class="gasto-marca-select-wrap ${mostrarExcluirMarca ? 'has-registered-brand' : ''}">
                <select class="gasto-lanc-marca-select" onchange="window.toggleMarcaOutrosGasto(this)">
                    ${window.renderOptionsMarcaGasto(usarOutrosMarca ? '__outros__' : marca)}
                </select>
                <button type="button" class="gasto-marca-delete-btn ${mostrarExcluirMarca ? 'visible' : ''}" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada">×</button>
            </div>
            <input class="gasto-lanc-marca-outros" type="text" placeholder="Nova marca" value="${usarOutrosMarca ? escapeHTMLGasto(marca) : ''}" style="${usarOutrosMarca ? '' : 'display:none;'}">
        </td>
        <td>
            <div class="gasto-local-select-wrap ${mostrarExcluirLocal ? 'has-registered-local' : ''}">
                <select class="gasto-lanc-local-select" onchange="window.toggleLocalOutrosGasto(this)">
                    ${window.renderOptionsLocalGasto(usarOutrosLocal ? '__outros__' : local)}
                </select>
                <button type="button" class="gasto-local-delete-btn ${mostrarExcluirLocal ? 'visible' : ''}" onclick="window.excluirLocalSelecionadoGasto(this)" title="Excluir local selecionado">×</button>
            </div>
            <input class="gasto-lanc-local-outros" type="text" placeholder="Novo local" value="${usarOutrosLocal ? escapeHTMLGasto(local) : ''}" style="${usarOutrosLocal ? '' : 'display:none;'}">
        </td>
        <td><input class="gasto-lanc-peso" type="text" placeholder="Kg/L" value="${escapeHTMLGasto(dados.peso || '')}"></td>
        <td><input class="gasto-lanc-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(qtd)}" oninput="window.atualizarTotalLancamentoGasto(this)"></td>
        <td><input class="gasto-lanc-unit" type="number" min="0" step="0.01" placeholder="0,00" value="${escapeHTMLGasto(unit)}" oninput="window.atualizarTotalLancamentoGasto(this)"></td>
        <td><input class="gasto-lanc-total" type="number" min="0" step="0.01" placeholder="0,00" value="${Number(total || 0).toFixed(2)}" readonly></td>
        <td><select class="gasto-lanc-comprador"><option value="Caixa" ${comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
        <td><input class="gasto-lanc-data" type="date" value="${escapeHTMLGasto(data)}"></td>
        <td>
            <div class="gasto-nota-wrap">
                <input class="gasto-lanc-nota" type="text" placeholder="Link da NF" value="${escapeHTMLGasto(dados.notaFiscalUrl || '')}">
                <button type="button" class="gastos-icon-btn copy" onclick="window.abrirNotaFiscalGasto(this)" title="Abrir nota fiscal"><i class="fas fa-file-invoice"></i></button>
            </div>
        </td>
        <td class="gastos-acoes-cell">
            <button class="gastos-icon-btn danger gastos-remover-linha" type="button" onclick="window.removerLinhaLancamentoGasto(this)" title="Remover linha"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`;
};

window.salvarLancamentosGasto = async function(itemId) {
    const item = getItemGasto(itemId);
    const container = document.querySelector(`.gastos-lancamento-lista[data-item-id="${itemId}"]`);
    if (!item || !container) return;

    const rows = Array.from(container.querySelectorAll('.gasto-lanc-row'));
    let salvou = 0;

    try {
        for (const row of rows) {
            if (row.classList.contains('gasto-lanc-row-removida')) continue;

            const lancId = row.querySelector('.gasto-lanc-id')?.value || '';
            const marca = window.getMarcaDaLinhaGasto(row);
            const localCompra = window.getLocalDaLinhaGasto(row);
            const peso = row.querySelector('.gasto-lanc-peso')?.value.trim() || '';
            const quantidade = Number(row.querySelector('.gasto-lanc-qtd')?.value || 0);
            const valorUnidade = Number(row.querySelector('.gasto-lanc-unit')?.value || 0);
            const valorTotal = quantidade * valorUnidade;
            const comprador = row.querySelector('.gasto-lanc-comprador')?.value || 'Caixa';
            const dataCompra = row.querySelector('.gasto-lanc-data')?.value || dataDefaultGasto(gastosMesAberto, getAnoGastosSelecionado());
            const notaFiscalUrl = row.querySelector('.gasto-lanc-nota')?.value.trim() || '';

            const linhaVazia = !marca && !localCompra && !peso && !quantidade && !valorUnidade;
            if (linhaVazia) continue;

            if (!marca) return window.showToast('Preencha a marca.', true);
            if (!quantidade || !valorUnidade) return window.showToast('Preencha quantidade e valor unidade.', true);
            if (!dataCompra || !comprador) return window.showToast('Preencha data e comprador.', true);

            await window.garantirMarcaGasto(marca);
            if (localCompra) await window.garantirLocalGasto(localCompra);

            const dataObj = parseDataISO(dataCompra);
            const payload = {
                itemId,
                itemNome: item.nome,
                nome: marca,
                marca,
                localCompra,
                peso,
                quantidade,
                valorUnidade,
                valorTotal,
                comprador,
                dataCompra,
                notaFiscalUrl,
                ano: dataObj ? dataObj.getFullYear() : getAnoGastosSelecionado(),
                mes: dataObj ? dataObj.getMonth() + 1 : gastosMesAberto,
                updatedAt: Date.now()
            };

            if (lancId) await updateDoc(doc(db, 'gastos_lancamentos', lancId), payload);
            else await addDoc(collection(db, 'gastos_lancamentos'), { ...payload, createdAt: Date.now() });

            salvou++;
        }

        window.showToast(salvou ? 'Lançamentos salvos!' : 'Nenhum lançamento novo para salvar.');
        window.atualizarSelectsMarcaGasto?.();
        window.renderGastosPlanilha();
    } catch(e) {
        console.error(e);
        window.showToast('Erro ao salvar lançamentos.', true);
    }
};

window.salvarCampoLancamentoGasto = async function(lancId, elemento) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;

    const row = elemento.closest('tr');
    if (!row) return;

    const marca = window.getMarcaDaLinhaGasto(row, '.gasto-list-marca-select', '.gasto-list-marca-outros');
    const localCompra = window.getLocalDaLinhaGasto(row, '.gasto-list-local-select', '.gasto-list-local-outros');
    const peso = row.querySelector('.gasto-list-peso')?.value.trim() || '';
    const quantidade = Number(row.querySelector('.gasto-list-qtd')?.value || 0);
    const valorUnidade = Number(row.querySelector('.gasto-list-unit')?.value || 0);
    const valorTotal = quantidade * valorUnidade;
    const comprador = row.querySelector('.gasto-list-comprador')?.value || 'Caixa';
    const dataCompra = row.querySelector('.gasto-list-data')?.value || l.dataCompra;
    const notaFiscalUrl = row.querySelector('.gasto-list-nota')?.value.trim() ?? l.notaFiscalUrl ?? '';

    if (!marca) return window.showToast('Preencha a marca.', true);

    await window.garantirMarcaGasto(marca);
    if (localCompra) await window.garantirLocalGasto(localCompra);

    const dataObj = parseDataISO(dataCompra);

    try {
        await updateDoc(doc(db, 'gastos_lancamentos', lancId), {
            nome: marca,
            marca,
            localCompra,
            peso,
            quantidade,
            valorUnidade,
            valorTotal,
            comprador,
            dataCompra,
            notaFiscalUrl,
            ano: dataObj ? dataObj.getFullYear() : l.ano,
            mes: dataObj ? dataObj.getMonth() + 1 : l.mes,
            updatedAt: Date.now()
        });

        window.atualizarSelectsMarcaGasto?.();
        window.showToast('Lançamento atualizado!');
    } catch(e) {
        console.error(e);
        window.showToast('Erro ao atualizar lançamento.', true);
    }
};

window.renderGastosDrawer = function(item, mesAtivo, ano, meses) {
    const lista = lancamentosDoItemMes(item.id, mesAtivo, ano).sort((a, b) => {
        const ca = Number(a.createdAt || 0);
        const cb = Number(b.createdAt || 0);
        if (ca !== cb) return ca - cb;
        return String(a.marca || a.nome || '').localeCompare(String(b.marca || b.nome || ''), 'pt-BR', { sensitivity: 'base' });
    });

    const dataPadrao = dataDefaultGasto(mesAtivo, ano);
    const mesNome = meses[Number(mesAtivo) - 1] || '';

    const cabecalhoTabela = `
        <thead><tr>
            <th>Marca</th>
            <th>Local</th>
            <th>Kg/L</th>
            <th>Quantidade</th>
            <th>Unidade</th>
            <th>Total</th>
            <th>Comprador</th>
            <th>Data</th>
            <th>Nota Fiscal</th>
            <th>Ações</th>
        </tr></thead>`;

    const tabelaLancamentos = lista.length ? `
        <div class="gastos-section-box gastos-rebuild-lancados-box">
            <div class="gastos-section-head gastos-rebuild-lancados-head">
                <strong class="gastos-rebuild-subtitle">Itens lançados</strong>
            </div>
            <div class="gastos-section-table-wrap gastos-rebuild-lancados-table-wrap">
                <table class="gastos-section-table gastos-rebuild-inner-table gastos-rebuild-lancados-table">
                    ${cabecalhoTabela}
                    <tbody>${lista.map(l => `
                        <tr>
                            <td>${window.renderCampoMarcaListaGasto(l)}</td>
                            <td>${window.renderCampoLocalListaGasto(l)}</td>
                            <td><input class="gasto-list-peso" value="${escapeHTMLGasto(l.peso || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-qtd" type="number" min="0" step="0.001" value="${escapeHTMLGasto(l.quantidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><input class="gasto-list-unit" type="number" min="0" step="0.01" value="${escapeHTMLGasto(l.valorUnidade || 0)}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td><strong class="gasto-list-total">${formatarMoedaGasto(l.valorTotal)}</strong></td>
                            <td><select class="gasto-list-comprador" onchange="window.salvarCampoLancamentoGasto('${l.id}', this)"><option value="Caixa" ${l.comprador === 'Caixa' ? 'selected' : ''}>Caixa</option><option value="Arabela" ${l.comprador === 'Arabela' ? 'selected' : ''}>Arabela</option><option value="Flávio" ${l.comprador === 'Flávio' ? 'selected' : ''}>Flávio</option></select></td>
                            <td><input class="gasto-list-data" type="date" value="${escapeHTMLGasto(l.dataCompra || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)"></td>
                            <td>
                                <div class="gasto-nota-wrap">
                                    <input class="gasto-list-nota" type="text" placeholder="Link da NF" value="${escapeHTMLGasto(l.notaFiscalUrl || '')}" onblur="window.salvarCampoLancamentoGasto('${l.id}', this)">
                                    <button type="button" class="gastos-icon-btn copy" onclick="window.abrirNotaFiscalGasto(this)" title="Abrir nota fiscal"><i class="fas fa-file-invoice"></i></button>
                                </div>
                            </td>
                            <td class="gastos-acoes-cell">
                                <div class="gastos-rebuild-lanc-actions">
                                    <button class="gastos-icon-btn copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                                    <button class="gastos-icon-btn danger" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>` : `<div class="gastos-section-box gastos-rebuild-lancados-box"><div class="gastos-section-head gastos-rebuild-lancados-head"><strong class="gastos-rebuild-subtitle">Itens lançados</strong></div><div class="gastos-empty" style="padding:18px !important;">Nenhum lançamento neste mês.</div></div>`;

    return `<tr class="gastos-rebuild-drawer-row"><td colspan="14">
        <div class="gastos-rebuild-drawer" id="gasto-drawer-${item.id}">
            <div class="gastos-rebuild-drawer-header">
                <div>
                    <div class="gastos-rebuild-drawer-title">${escapeHTMLGasto(item.nome)} — ${mesNome}/${ano}</div>
                </div>
                <div class="gastos-rebuild-drawer-actions">
                    <button class="gastos-icon-btn danger" onclick="window.fecharGastosItem()" title="Fechar"><i class="fas fa-times"></i></button>
                </div>
            </div>

            <div class="gastos-section-box gastos-rebuild-add-box">
                <div class="gastos-section-head gastos-rebuild-add-head">
                    <strong class="gastos-rebuild-subtitle">Lançar itens</strong>
                    <div class="gastos-rebuild-drawer-actions">
                        <button class="gastos-icon-btn copy" type="button" onclick="window.adicionarLinhaLancamentoGasto('${item.id}')" title="Adicionar linha"><i class="fas fa-plus"></i></button>
                        <button class="gastos-icon-btn save" type="button" onclick="window.salvarLancamentosGasto('${item.id}')" title="Salvar todos"><i class="fas fa-check"></i></button>
                    </div>
                </div>
                <div class="gastos-section-table-wrap gastos-rebuild-lancar-table-wrap">
                    <table class="gastos-section-table gastos-rebuild-inner-table gastos-rebuild-lancar-table">
                        ${cabecalhoTabela}
                        <tbody class="gastos-lancamento-lista" data-item-id="${item.id}" data-mes="${mesAtivo}" data-ano="${ano}">
                            ${window.criarLinhaLancamentoGastoHTML({ dataCompra: dataPadrao })}
                        </tbody>
                    </table>
                </div>
            </div>

            ${tabelaLancamentos}
        </div>
    </td></tr>`;
};

const copiarLancamentoGastoLocalCompraOriginal = window.copiarLancamentoGasto;
window.copiarLancamentoGasto = async function(lancId) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return copiarLancamentoGastoLocalCompraOriginal?.(lancId);
    const copia = { ...l, id: '', createdAt: Date.now(), updatedAt: Date.now() };
    delete copia.id;
    // Uma cópia é um lançamento novo e independente — não deve herdar o vínculo de parcelamento.
    delete copia.parcelaGrupoId;
    delete copia.parcelaAtual;
    delete copia.parcelaTotal;
    delete copia.parcelaValorTotalOriginal;
    delete copia.parcelaValorUnidadeOriginal;
    try {
        await addDoc(collection(db, 'gastos_lancamentos'), copia);
        window.showToast('Lançamento copiado!');
    } catch(e) {
        console.error(e);
        window.showToast('Erro ao copiar lançamento.', true);
    }
};

try {
    if (!window.__gastosLocaisListenerStarted) {
        window.__gastosLocaisListenerStarted = true;
        onSnapshot(collection(db, 'gastos_locais'), snap => {
            window.allGastosLocais = [];
            snap.forEach(d => window.allGastosLocais.push({ id: d.id, ...d.data() }));
            window.renderGastosPlanilha?.();
        }, err => console.warn('Não foi possível carregar locais de compra:', err));
    }
} catch(e) {
    console.warn('Listener de locais de compra não iniciado:', e);
}




// === GASTOS 2026-06-21: cabeçalho da tabela principal fixo ao rolar ===
window.destroyGastosFixedHeader = function() {
    const antigo = document.getElementById('gastos-fixed-header-clone');
    if (antigo) antigo.remove();
};

window.getGastosMainTable = function() {
    return document.querySelector('#t-gastos table.gastos-rebuild-table, #t-gastos table.gastos-planilha-table');
};

window.getGastosTableScroller = function(table) {
    if (!table) return null;
    return table.closest('.gastos-rebuild-table-card, .gastos-planilha-wrap, .table-responsive, .panel-card') || table.parentElement;
};

window.syncGastosFixedHeader = function() {
    const gastosPane = document.getElementById('t-gastos');
    const table = window.getGastosMainTable?.();
    const thead = table?.querySelector(':scope > thead');
    if (!gastosPane || !table || !thead || !document.body.contains(table)) {
        window.destroyGastosFixedHeader?.();
        return;
    }

    const paneStyle = window.getComputedStyle(gastosPane);
    if (paneStyle.display === 'none' || gastosPane.hidden) {
        window.destroyGastosFixedHeader?.();
        return;
    }

    const scroller = window.getGastosTableScroller(table);
    const tableRect = table.getBoundingClientRect();
    const theadRect = thead.getBoundingClientRect();
    const scrollerRect = (scroller || table).getBoundingClientRect();

    const topOffset = 0;
    const shouldShow = tableRect.top < topOffset && tableRect.bottom > (theadRect.height + topOffset + 8);

    let cloneWrap = document.getElementById('gastos-fixed-header-clone');
    if (!shouldShow) {
        if (cloneWrap) cloneWrap.style.display = 'none';
        return;
    }

    if (!cloneWrap) {
        cloneWrap = document.createElement('div');
        cloneWrap.id = 'gastos-fixed-header-clone';
        document.body.appendChild(cloneWrap);
    }

    const sourceThs = Array.from(thead.querySelectorAll('th'));
    const colgroup = `<colgroup>${sourceThs.map(th => `<col style="width:${Math.round(th.getBoundingClientRect().width)}px">`).join('')}</colgroup>`;
    cloneWrap.innerHTML = `<table>${colgroup}<thead>${thead.innerHTML}</thead></table>`;

    const cloneTable = cloneWrap.querySelector('table');
    const visibleLeft = Math.max(scrollerRect.left, 0);
    const visibleRight = Math.min(scrollerRect.right, window.innerWidth);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);

    cloneWrap.style.display = visibleWidth > 0 ? 'block' : 'none';
    cloneWrap.style.left = `${visibleLeft}px`;
    cloneWrap.style.top = `${topOffset}px`;
    cloneWrap.style.width = `${visibleWidth}px`;
    cloneWrap.style.height = `${Math.ceil(theadRect.height) + 4}px`;

    if (cloneTable) {
        cloneTable.style.width = `${Math.round(tableRect.width)}px`;
        cloneTable.style.transform = `translateX(-${scroller?.scrollLeft || 0}px)`;
    }
};

window.scheduleGastosFixedHeaderSync = function() {
    if (window.__gastosFixedHeaderRaf) cancelAnimationFrame(window.__gastosFixedHeaderRaf);
    window.__gastosFixedHeaderRaf = requestAnimationFrame(() => window.syncGastosFixedHeader?.());
};

if (!window.__gastosFixedHeaderEventsStarted) {
    window.__gastosFixedHeaderEventsStarted = true;
    window.addEventListener('scroll', window.scheduleGastosFixedHeaderSync, { passive: true });
    window.addEventListener('resize', window.scheduleGastosFixedHeaderSync, { passive: true });
    document.addEventListener('scroll', window.scheduleGastosFixedHeaderSync, true);
    document.addEventListener('click', () => setTimeout(window.scheduleGastosFixedHeaderSync, 100), true);
    setInterval(window.scheduleGastosFixedHeaderSync, 700);
}

const renderGastosPlanilhaCabecalhoFixoOriginal = window.renderGastosPlanilha;
window.renderGastosPlanilha = function(...args) {
    const retorno = renderGastosPlanilhaCabecalhoFixoOriginal.apply(this, args);
    setTimeout(window.scheduleGastosFixedHeaderSync, 80);
    const table = window.getGastosMainTable?.();
    const scroller = window.getGastosTableScroller?.(table);
    if (scroller && !scroller.__gastosFixedHeaderScrollBound) {
        scroller.__gastosFixedHeaderScrollBound = true;
        scroller.addEventListener('scroll', window.scheduleGastosFixedHeaderSync, { passive: true });
    }
    return retorno;
};

setTimeout(window.scheduleGastosFixedHeaderSync, 300);




// === GASTOS 2026-06-21: desativar clone fixo e deixar só a tabela rolar ===
window.destroyGastosFixedHeader = function() {
    const antigo = document.getElementById('gastos-fixed-header-clone');
    if (antigo) antigo.remove();
};

window.syncGastosFixedHeader = function() {
    window.destroyGastosFixedHeader?.();
};

window.scheduleGastosFixedHeaderSync = function() {
    window.destroyGastosFixedHeader?.();
};

const renderGastosPlanilhaRolagemItensOriginal = window.renderGastosPlanilha;
window.renderGastosPlanilha = function(...args) {
    const retorno = renderGastosPlanilhaRolagemItensOriginal.apply(this, args);
    setTimeout(() => {
        window.destroyGastosFixedHeader?.();
        const table = document.querySelector('#t-gastos table.gastos-rebuild-table, #t-gastos table.gastos-planilha-table');
        const wrap = table?.closest('.gastos-rebuild-table-card, .gastos-planilha-wrap, .table-responsive, .panel-card');
        if (wrap) {
            wrap.style.overflowY = 'auto';
            wrap.style.overflowX = 'auto';
        }
    }, 50);
    return retorno;
};

setTimeout(() => window.destroyGastosFixedHeader?.(), 100);
setTimeout(() => window.destroyGastosFixedHeader?.(), 600);




// === GASTOS 2026-06-21: impedir clone e manter scroll apenas no tbody ===
window.destroyGastosFixedHeader = function() {
    const antigo = document.getElementById('gastos-fixed-header-clone');
    if (antigo) antigo.remove();
};

window.syncGastosFixedHeader = function() {
    window.destroyGastosFixedHeader?.();
};

window.scheduleGastosFixedHeaderSync = function() {
    window.destroyGastosFixedHeader?.();
};

const renderGastosPlanilhaScrollTbodyOriginal = window.renderGastosPlanilha;
window.renderGastosPlanilha = function(...args) {
    const retorno = renderGastosPlanilhaScrollTbodyOriginal.apply(this, args);
    setTimeout(() => {
        window.destroyGastosFixedHeader?.();
        const body = document.getElementById('gastos-planilha-body');
        if (body) {
            body.style.overflowY = 'auto';
            body.style.overflowX = 'hidden';
        }
    }, 60);
    return retorno;
};

setTimeout(() => window.destroyGastosFixedHeader?.(), 100);
setTimeout(() => window.destroyGastosFixedHeader?.(), 600);




// === GASTOS 2026-06-21: marcas/locais em ordem alfabética e padrão Selecione ===
window.ordenarOpcoesGastoAlfabetico = function(lista) {
    return [...(lista || [])]
        .filter(v => String(v || '').trim())
        .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', {
            sensitivity: 'base',
            numeric: true,
            ignorePunctuation: true
        }));
};

window.marcasGastosDisponiveis = function() {
    const mapa = new Map();
    const ocultas = window.getGastosMarcasOcultas ? window.getGastosMarcasOcultas() : new Set();

    (window.allGastosMarcas || []).forEach(m => {
        const nome = String(m.nome || m.marca || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !ocultas.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    (allGastosLancamentos || []).forEach(l => {
        const nome = String(l.marca || l.nome || '').trim();
        const chave = window.normalizarMarcaGasto(nome);
        if (nome && !ocultas.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    return window.ordenarOpcoesGastoAlfabetico([...mapa.values()]);
};

window.locaisGastosDisponiveis = function() {
    const mapa = new Map();
    const ocultos = window.getGastosLocaisOcultos ? window.getGastosLocaisOcultos() : new Set();

    (window.allGastosLocais || []).forEach(l => {
        const nome = String(l.nome || l.local || l.localCompra || '').trim();
        const chave = window.normalizarLocalGasto ? window.normalizarLocalGasto(nome) : String(nome).toLowerCase().trim();
        if (nome && !ocultos.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    (allGastosLancamentos || []).forEach(l => {
        const nome = String(l.localCompra || l.local || '').trim();
        const chave = window.normalizarLocalGasto ? window.normalizarLocalGasto(nome) : String(nome).toLowerCase().trim();
        if (nome && !ocultos.has(chave) && !mapa.has(chave)) mapa.set(chave, nome);
    });

    return window.ordenarOpcoesGastoAlfabetico([...mapa.values()]);
};

window.renderOptionsMarcaGasto = function(marcaSelecionada = '') {
    const marcas = window.marcasGastosDisponiveis();
    const marcaAtual = String(marcaSelecionada || '').trim();
    const chaveAtual = window.normalizarMarcaGasto(marcaAtual);
    const existe = marcas.some(m => window.normalizarMarcaGasto(m) === chaveAtual);
    const selecionarOutros = marcaAtual === '__outros__' || (marcaAtual && !existe);

    let html = `<option value="" ${!marcaAtual ? 'selected' : ''}>Selecione...</option>`;
    marcas.forEach(m => {
        const selected = !selecionarOutros && window.normalizarMarcaGasto(m) === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(m)}" ${selected}>${escapeHTMLGasto(m)}</option>`;
    });
    html += `<option value="__outros__" ${selecionarOutros ? 'selected' : ''}>Outros</option>`;
    return html;
};

window.renderOptionsLocalGasto = function(localSelecionado = '') {
    const locais = window.locaisGastosDisponiveis();
    const atual = String(localSelecionado || '').trim();
    const chaveAtual = window.normalizarLocalGasto ? window.normalizarLocalGasto(atual) : String(atual).toLowerCase().trim();
    const existe = locais.some(l => (window.normalizarLocalGasto ? window.normalizarLocalGasto(l) : String(l).toLowerCase().trim()) === chaveAtual);
    const selecionarOutros = atual === '__outros__' || (atual && !existe);

    let html = `<option value="" ${!atual ? 'selected' : ''}>Selecione...</option>`;
    locais.forEach(l => {
        const chave = window.normalizarLocalGasto ? window.normalizarLocalGasto(l) : String(l).toLowerCase().trim();
        const selected = !selecionarOutros && chave === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(l)}" ${selected}>${escapeHTMLGasto(l)}</option>`;
    });
    html += `<option value="__outros__" ${selecionarOutros ? 'selected' : ''}>Outros</option>`;
    return html;
};

// Garante que novas linhas sempre abram com Marca em "Selecione", e não em "Outros".
const criarLinhaLancamentoGastoHTMLAlfabeticoOriginal = window.criarLinhaLancamentoGastoHTML;
window.criarLinhaLancamentoGastoHTML = function(dados = {}) {
    const dadosNormalizados = { ...(dados || {}) };
    if (!String(dadosNormalizados.marca || dadosNormalizados.nome || '').trim()) {
        dadosNormalizados.marca = '';
        dadosNormalizados.nome = '';
    }
    if (!String(dadosNormalizados.localCompra || dadosNormalizados.local || '').trim()) {
        dadosNormalizados.localCompra = '';
        dadosNormalizados.local = '';
    }
    return criarLinhaLancamentoGastoHTMLAlfabeticoOriginal(dadosNormalizados);
};




// === GASTOS 2026-06-21: Outros logo após Selecione e Local renomeado ===
window.renderOptionsMarcaGasto = function(marcaSelecionada = '') {
    const marcas = window.marcasGastosDisponiveis();
    const marcaAtual = String(marcaSelecionada || '').trim();
    const chaveAtual = window.normalizarMarcaGasto(marcaAtual);
    const existe = marcas.some(m => window.normalizarMarcaGasto(m) === chaveAtual);
    const selecionarOutros = marcaAtual === '__outros__' || (marcaAtual && !existe);

    let html = `<option value="" ${!marcaAtual ? 'selected' : ''}>Selecione...</option>`;
    html += `<option value="__outros__" ${selecionarOutros ? 'selected' : ''}>Outros</option>`;
    marcas.forEach(m => {
        const selected = !selecionarOutros && window.normalizarMarcaGasto(m) === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(m)}" ${selected}>${escapeHTMLGasto(m)}</option>`;
    });
    return html;
};

window.renderOptionsLocalGasto = function(localSelecionado = '') {
    const locais = window.locaisGastosDisponiveis();
    const atual = String(localSelecionado || '').trim();
    const chaveAtual = window.normalizarLocalGasto ? window.normalizarLocalGasto(atual) : String(atual).toLowerCase().trim();
    const existe = locais.some(l => (window.normalizarLocalGasto ? window.normalizarLocalGasto(l) : String(l).toLowerCase().trim()) === chaveAtual);
    const selecionarOutros = atual === '__outros__' || (atual && !existe);

    let html = `<option value="" ${!atual ? 'selected' : ''}>Selecione...</option>`;
    html += `<option value="__outros__" ${selecionarOutros ? 'selected' : ''}>Outros</option>`;
    locais.forEach(l => {
        const chave = window.normalizarLocalGasto ? window.normalizarLocalGasto(l) : String(l).toLowerCase().trim();
        const selected = !selecionarOutros && chave === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(l)}" ${selected}>${escapeHTMLGasto(l)}</option>`;
    });
    return html;
};

window.toggleMarcaOutrosGasto = function(select) {
    const row = select.closest('.gasto-lanc-row, tr');
    const inputOutros = row?.querySelector('.gasto-lanc-marca-outros, .gasto-list-marca-outros');

    if (inputOutros) {
        if (select.value === '__outros__') {
            inputOutros.style.display = '';
            inputOutros.focus();
        } else {
            inputOutros.style.display = 'none';
            inputOutros.value = '';
        }
    }

    window.atualizarBotaoExcluirMarcaGasto?.(select);
};

window.toggleLocalOutrosGasto = function(select) {
    const row = select.closest('.gasto-lanc-row, tr');
    const inputOutros = row?.querySelector('.gasto-lanc-local-outros, .gasto-list-local-outros');

    if (inputOutros) {
        if (select.value === '__outros__') {
            inputOutros.style.display = '';
            inputOutros.focus();
        } else {
            inputOutros.style.display = 'none';
            inputOutros.value = '';
        }
    }

    window.atualizarBotaoExcluirLocalGasto?.(select);
};

const renderGastosDrawerLocalRenomeadoOriginal = window.renderGastosDrawer;
window.renderGastosDrawer = function(...args) {
    const html = renderGastosDrawerLocalRenomeadoOriginal.apply(this, args);
    return String(html).replaceAll('Local', 'Local');
};




// === GASTOS 2026-06-21: Nova marca só aparece quando Marca = Outros ===
window.ajustarCamposNovaMarcaGasto = function(scope = document) {
    (scope || document).querySelectorAll('#t-gastos .gasto-lanc-row').forEach(row => {
        const select = row.querySelector('.gasto-lanc-marca-select');
        const input = row.querySelector('.gasto-lanc-marca-outros');
        if (!select || !input) return;

        if (select.value === '__outros__') {
            input.classList.add('show-outros');
            input.style.setProperty('display', 'block', 'important');
        } else {
            input.classList.remove('show-outros');
            input.style.setProperty('display', 'none', 'important');
        }
    });
};

window.toggleMarcaOutrosGasto = function(select) {
    const row = select.closest('.gasto-lanc-row, tr');
    const inputOutros = row?.querySelector('.gasto-lanc-marca-outros, .gasto-list-marca-outros');

    if (inputOutros) {
        if (select.value === '__outros__') {
            inputOutros.classList.add('show-outros');
            inputOutros.style.setProperty('display', 'block', 'important');
            inputOutros.focus();
        } else {
            inputOutros.classList.remove('show-outros');
            inputOutros.style.setProperty('display', 'none', 'important');
            inputOutros.value = '';
        }
    }

    window.atualizarBotaoExcluirMarcaGasto?.(select);
};

const criarLinhaLancamentoGastoHTMLNovaMarcaOriginal = window.criarLinhaLancamentoGastoHTML;
window.criarLinhaLancamentoGastoHTML = function(dados = {}) {
    const html = criarLinhaLancamentoGastoHTMLNovaMarcaOriginal(dados);
    setTimeout(() => window.ajustarCamposNovaMarcaGasto(document), 30);
    return html;
};

const renderGastosPlanilhaNovaMarcaOriginal = window.renderGastosPlanilha;
window.renderGastosPlanilha = function(...args) {
    const retorno = renderGastosPlanilhaNovaMarcaOriginal.apply(this, args);
    setTimeout(() => window.ajustarCamposNovaMarcaGasto(document), 80);
    return retorno;
};

const adicionarLinhaLancamentoGastoNovaMarcaOriginal = window.adicionarLinhaLancamentoGasto;
window.adicionarLinhaLancamentoGasto = function(...args) {
    const retorno = adicionarLinhaLancamentoGastoNovaMarcaOriginal.apply(this, args);
    setTimeout(() => window.ajustarCamposNovaMarcaGasto(document), 50);
    return retorno;
};

setTimeout(() => window.ajustarCamposNovaMarcaGasto(document), 300);




// ==========================================
// NOVO (2026-08): Nota Fiscal, Lançar Vários Gastos e Exportar Mês
// Tudo abaixo é adição pura — nenhuma função existente acima foi removida.
// ==========================================

// Abre o link salvo no campo "Nota Fiscal" (usado na linha nova, na lista de já lançados e no lote).
window.abrirNotaFiscalGasto = function(botao) {
    const wrap = botao.closest('.gasto-nota-wrap');
    const input = wrap ? wrap.querySelector('input') : null;
    const url = String(input?.value || '').trim();
    if (!url) {
        input?.focus();
        return window.showToast('Cole o link da nota fiscal primeiro.', true);
    }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    window.open(href, '_blank', 'noopener');
};

window.GASTOS_NOMES_MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

window.formatarDataCurtaGasto = function(iso) {
    const partes = String(iso || '').split('-');
    if (partes.length !== 3) return iso || '-';
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
};

// ==========================================
// NOVO (2026-08): opção "+ Adicionar" nos selects de Item/Marca/Local do fluxo de lançamento
// (substitui "Outros" — cadastra direto, sem sair da tela)
// ==========================================
window.SENTINELA_ADICIONAR_GASTO = '__adicionar__';

window.renderOptionsMarcaGasto = function(marcaSelecionada = '') {
    const marcas = window.marcasGastosDisponiveis();
    const atual = String(marcaSelecionada || '').trim();
    const chaveAtual = window.normalizarMarcaGasto(atual);

    let html = `<option value="" ${!atual ? 'selected' : ''}>Selecione...</option>`;
    html += `<option value="${window.SENTINELA_ADICIONAR_GASTO}">+ Adicionar marca</option>`;
    marcas.forEach(m => {
        const selected = window.normalizarMarcaGasto(m) === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(m)}" ${selected}>${escapeHTMLGasto(m)}</option>`;
    });
    return html;
};

window.renderOptionsLocalGasto = function(localSelecionado = '') {
    const locais = window.locaisGastosDisponiveis();
    const atual = String(localSelecionado || '').trim();
    const chaveAtual = window.normalizarLocalGasto ? window.normalizarLocalGasto(atual) : atual.toLowerCase();

    let html = `<option value="" ${!atual ? 'selected' : ''}>Selecione...</option>`;
    html += `<option value="${window.SENTINELA_ADICIONAR_GASTO}">+ Adicionar local</option>`;
    locais.forEach(l => {
        const chave = window.normalizarLocalGasto ? window.normalizarLocalGasto(l) : String(l).toLowerCase();
        const selected = chave === chaveAtual ? 'selected' : '';
        html += `<option value="${escapeHTMLGasto(l)}" ${selected}>${escapeHTMLGasto(l)}</option>`;
    });
    return html;
};

window.atualizarTodosSelectsMarcaGasto = function(nomeParaSelecionar, selectOrigem) {
    document.querySelectorAll('.gasto-lote-marca-select, #edit-lanc-marca').forEach(sel => {
        const manterValor = sel === selectOrigem ? nomeParaSelecionar : sel.value;
        sel.innerHTML = window.renderOptionsMarcaGasto(manterValor);
        window.atualizarBotaoExcluirMarcaGasto?.(sel);
    });
};

window.atualizarTodosSelectsLocalGasto = function(nomeParaSelecionar, selectOrigem) {
    document.querySelectorAll('.gasto-lote-local-select, #edit-lanc-local, #gasto-lote-local-unico').forEach(sel => {
        const manterValor = sel === selectOrigem ? nomeParaSelecionar : sel.value;
        sel.innerHTML = window.renderOptionsLocalGasto(manterValor);
        window.atualizarBotaoExcluirLocalGasto?.(sel);
    });
};

// Encontra, a partir do <select>, o campo de texto "+ Adicionar" (input escondido logo
// após o wrap do select) usado para cadastrar item/marca/local sem sair da tela.
window.encontrarInputNovoValorGasto = function(select, wrapClass, inputClass) {
    const wrap = select?.closest?.(`.${wrapClass}`);
    const input = wrap?.nextElementSibling;
    return (input && input.classList && input.classList.contains(inputClass)) ? input : null;
};

window.tratarSelecaoMarcaGasto = function(select) {
    const input = window.encontrarInputNovoValorGasto(select, 'gasto-marca-select-wrap', 'gasto-marca-novo-input');
    if (select.value === window.SENTINELA_ADICIONAR_GASTO) {
        if (input) { input.style.display = ''; input.value = ''; input.focus(); }
    } else if (input) {
        input.style.display = 'none';
    }
    window.atualizarBotaoExcluirMarcaGasto?.(select);
};

window.tratarSelecaoLocalGasto = function(select) {
    const input = window.encontrarInputNovoValorGasto(select, 'gasto-local-select-wrap', 'gasto-local-novo-input');
    if (select.value === window.SENTINELA_ADICIONAR_GASTO) {
        if (input) { input.style.display = ''; input.value = ''; input.focus(); }
    } else if (input) {
        input.style.display = 'none';
    }
    window.atualizarBotaoExcluirLocalGasto?.(select);
};

// Confirma o cadastro digitado inline (chamado ao sair do campo ou apertar Enter).
window.confirmarNovaMarcaGastoInline = async function(inputEl) {
    const nome = inputEl.value.trim();
    const wrap = inputEl.previousElementSibling;
    const select = wrap?.querySelector?.('select');
    if (!nome) {
        if (select) select.value = '';
        inputEl.style.display = 'none';
        window.atualizarBotaoExcluirMarcaGasto?.(select);
        return;
    }
    try {
        await window.garantirMarcaGasto(nome);
        window.atualizarTodosSelectsMarcaGasto(nome, select);
        inputEl.style.display = 'none';
        window.showToast('Marca cadastrada!');
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao cadastrar marca.', true);
    }
};

window.confirmarNovoLocalGastoInline = async function(inputEl) {
    const nome = inputEl.value.trim();
    const wrap = inputEl.previousElementSibling;
    const select = wrap?.querySelector?.('select');
    if (!nome) {
        if (select) select.value = '';
        inputEl.style.display = 'none';
        window.atualizarBotaoExcluirLocalGasto?.(select);
        return;
    }
    try {
        await window.garantirLocalGasto(nome);
        window.atualizarTodosSelectsLocalGasto(nome, select);
        inputEl.style.display = 'none';
        window.showToast('Local cadastrado!');
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao cadastrar local.', true);
    }
};

// --- Item: mesmo padrão de "+ Adicionar" inline + exclusão da marca/local, aplicado ao Item ---
window.garantirItemGasto = async function(nome) {
    const nomeLimpo = String(nome || '').trim();
    if (!nomeLimpo) return null;

    const existente = allGastosItens.find(i => String(i.nome || '').trim().toLowerCase() === nomeLimpo.toLowerCase());
    if (existente) return existente;

    try {
        const ref = await addDoc(collection(db, 'gastos_itens'), { nome: nomeLimpo, ordem: Date.now(), createdAt: Date.now() });
        const novo = { id: ref.id, nome: nomeLimpo, ordem: Date.now(), createdAt: Date.now() };
        allGastosItens.push(novo);
        return novo;
    } catch (e) {
        console.warn('Não foi possível salvar item novo:', e);
        return null;
    }
};

window.atualizarBotaoExcluirItemGastoSelect = function(select) {
    const wrap = select?.closest?.('.gasto-item-select-wrap');
    const btn = wrap?.querySelector?.('.gasto-item-delete-btn');
    if (!wrap || !btn) return;

    const cadastrado = !!(select.value && select.value !== window.SENTINELA_ADICIONAR_GASTO);
    wrap.classList.toggle('has-registered-brand', cadastrado);
    btn.classList.toggle('visible', cadastrado);
    btn.style.display = cadastrado ? 'inline-flex' : 'none';
};

window.atualizarTodosSelectsItemGasto = function(idParaSelecionar, selectOrigem) {
    document.querySelectorAll('.gasto-lote-item, #edit-lanc-item').forEach(sel => {
        const manterValor = sel === selectOrigem ? idParaSelecionar : sel.value;
        sel.innerHTML = window.montarOptionsItensGasto(manterValor);
        window.atualizarBotaoExcluirItemGastoSelect(sel);
    });
};

window.confirmarNovoItemGastoInline = async function(inputEl) {
    const nome = inputEl.value.trim();
    const wrap = inputEl.previousElementSibling;
    const select = wrap?.querySelector?.('select');
    if (!nome) {
        if (select) select.value = '';
        inputEl.style.display = 'none';
        window.atualizarBotaoExcluirItemGastoSelect(select);
        return;
    }
    const item = await window.garantirItemGasto(nome);
    if (!item) { window.showToast('Erro ao cadastrar item.', true); return; }
    window.atualizarTodosSelectsItemGasto(item.id, select);
    inputEl.style.display = 'none';
    window.showToast('Item cadastrado!');
};

window.excluirItemSelecionadoGasto = function(botao) {
    const wrap = botao.closest('.gasto-item-select-wrap');
    const select = wrap?.querySelector('select');
    const itemId = String(select?.value || '').trim();
    const item = itemId && itemId !== window.SENTINELA_ADICIONAR_GASTO ? getItemGasto(itemId) : null;

    if (!item) {
        return window.showToast('Selecione um item cadastrado para excluir.', true);
    }

    customConfirm(`Excluir o item "${item.nome}" e todos os lançamentos vinculados?`, async () => {
        try {
            await Promise.all(allGastosLancamentos.filter(l => l.itemId === itemId).map(l => deleteDoc(doc(db, 'gastos_lancamentos', l.id))));
            await deleteDoc(doc(db, 'gastos_itens', itemId));
            allGastosItens = allGastosItens.filter(i => i.id !== itemId);
            window.atualizarTodosSelectsItemGasto('', select);
            window.showToast('Item excluído!');
        } catch (e) {
            console.error(e);
            window.showToast('Erro ao excluir item.', true);
        }
    });
};

window.aguardarItemGastoDisponivel = function(nome, tentativas = 15) {
    return new Promise(resolve => {
        const tentar = (n) => {
            const item = allGastosItens.find(i => String(i.nome || '').trim().toLowerCase() === nome.toLowerCase());
            if (item || n <= 0) return resolve(item || null);
            setTimeout(() => tentar(n - 1), 200);
        };
        tentar(tentativas);
    });
};

window.tratarSelecaoItemGasto = function(select) {
    const input = window.encontrarInputNovoValorGasto(select, 'gasto-item-select-wrap', 'gasto-item-novo-input');
    if (select.value === window.SENTINELA_ADICIONAR_GASTO) {
        if (input) { input.style.display = ''; input.value = ''; input.focus(); }
    } else if (input) {
        input.style.display = 'none';
    }
    window.atualizarBotaoExcluirItemGastoSelect(select);
};

// Após cadastrar um novo Item (via "+ Adicionar" de dentro do lançamento), seleciona-o
// automaticamente no select que originou o pedido — sem alterar o fluxo normal de "Novo Item".
const salvarItemGastoModalComSelecaoPendenteOriginal = window.salvarItemGastoModal;
window.salvarItemGastoModal = async function(event) {
    const eraEdicao = !!document.getElementById('gasto-item-id')?.value;
    const nomeDigitado = String(document.getElementById('gasto-item-nome')?.value || '').trim();
    const retorno = await salvarItemGastoModalComSelecaoPendenteOriginal(event);

    if (!eraEdicao && nomeDigitado && window.__gastoItemSelectPendente) {
        const select = window.__gastoItemSelectPendente;
        window.__gastoItemSelectPendente = null;
        const item = await window.aguardarItemGastoDisponivel(nomeDigitado);
        if (item && select && document.body.contains(select)) {
            if (!Array.from(select.options).some(o => o.value === item.id)) {
                select.insertAdjacentHTML('beforeend', `<option value="${item.id}">${escapeHTMLGasto(item.nome)}</option>`);
            }
            select.value = item.id;
        }
    }
    return retorno;
};

// --- Lançar Vários Gastos: várias linhas, itens diferentes, em um único salvamento ---
// Local, Nota Fiscal e Data ficam ÚNICOS no topo do formulário (a compra é a mesma para todos os itens).
window.criarLinhaGastoLoteHTML = function() {
    const itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    let optionsItens = `<option value="">Selecione o item...</option><option value="${window.SENTINELA_ADICIONAR_GASTO}">+ Adicionar item</option>`;
    itens.forEach(i => { optionsItens += `<option value="${i.id}">${escapeHTMLGasto(i.nome)}</option>`; });

    return `<tr class="gasto-lote-row">
        <td data-label="Item:">
            <div class="gasto-campo-com-novo">
                <div class="gasto-item-select-wrap">
                    <select class="gasto-lote-item" onchange="window.tratarSelecaoItemGasto(this)">${optionsItens}</select>
                    <button type="button" class="gasto-item-delete-btn" onclick="window.excluirItemSelecionadoGasto(this)" title="Excluir item selecionado"><i class="fas fa-trash"></i></button>
                </div>
                <input type="text" class="gasto-item-novo-input" placeholder="Nome do novo item" style="display:none;" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}" onblur="window.confirmarNovoItemGastoInline(this)">
            </div>
        </td>
        <td data-label="Marca:">
            <div class="gasto-campo-com-novo">
                <div class="gasto-marca-select-wrap">
                    <select class="gasto-lote-marca-select" onchange="window.tratarSelecaoMarcaGasto(this)">${window.renderOptionsMarcaGasto('')}</select>
                    <button type="button" class="gasto-marca-delete-btn" onclick="window.excluirMarcaSelecionadaGasto(this)" title="Excluir marca selecionada"><i class="fas fa-trash"></i></button>
                </div>
                <input type="text" class="gasto-marca-novo-input" placeholder="Nome da nova marca" style="display:none;" onkeydown="if(event.key==='Enter'){event.preventDefault(); this.blur();}" onblur="window.confirmarNovaMarcaGastoInline(this)">
            </div>
        </td>
        <td data-label="Medida:"><input class="gasto-lote-peso" type="text" placeholder="Medida"></td>
        <td data-label="Quantidade:"><input class="gasto-lote-qtd" type="number" min="0" step="0.001" value="1" oninput="window.atualizarTotalGastoLote(this)"></td>
        <td data-label="Unidade:"><input class="gasto-lote-unit" type="number" min="0" step="0.01" placeholder="0,00" oninput="window.atualizarTotalGastoLote(this)"></td>
        <td data-label="Total:"><input class="gasto-lote-total" type="number" min="0" step="0.01" value="0.00" readonly></td>
        <td data-label="Comprador:"><select class="gasto-lote-comprador"><option value="Caixa" selected>Caixa</option><option value="Arabela">Arabela</option><option value="Flávio">Flávio</option></select></td>
        <td data-label="Observação:">
            <input class="gasto-lote-obs" type="text" placeholder="Observação">
        </td>
        <td class="gastos-acoes-cell" data-label="Ações:">
            <button class="gastos-icon-btn danger" type="button" onclick="window.removerLinhaGastoLote(this)" title="Remover linha"><i class="fas fa-trash"></i></button>
        </td>
    </tr>`;
};

// Gera as <option> "À vista" + 2x a 50x, pro select único "Parcelamento" do lote.
window.gerarOptionsParcelamento = function(selecionado) {
    const num = Number(selecionado) || 1;
    let html = `<option value="1" ${num === 1 ? 'selected' : ''}>À vista</option>`;
    html += window.gerarOptionsParcelas(num);
    return html;
};

// Gera as <option> de 2x a 50x, reaproveitadas no select "Parcelamento" do lote e no da edição.
window.gerarOptionsParcelas = function(selecionado) {
    let html = '';
    for (let i = 2; i <= 50; i++) {
        html += `<option value="${i}" ${Number(selecionado) === i ? 'selected' : ''}>${i}x</option>`;
    }
    return html;
};

// "Parcelamento" agora é um único select do lote inteiro (igual Local/Nota Fiscal/Data da
// compra) - não mais checkbox+campo por linha/item. Todas as linhas preenchidas do lote
// usam a mesma opção de parcelamento (À vista = sem parcelar, ou 2x a 50x).

window.atualizarTotalGastoLote = function(elemento) {
    const row = elemento.closest('.gasto-lote-row');
    if (!row) return;
    const qtd = Number(row.querySelector('.gasto-lote-qtd')?.value || 0);
    const unit = Number(row.querySelector('.gasto-lote-unit')?.value || 0);
    const total = row.querySelector('.gasto-lote-total');
    if (total) total.value = (qtd * unit).toFixed(2);
};

window.adicionarLinhaGastoLote = function() {
    const tbody = document.getElementById('gastos-lote-rows');
    if (!tbody) return;
    tbody.insertAdjacentHTML('beforeend', window.criarLinhaGastoLoteHTML());
    const novaLinha = tbody.lastElementChild;
    novaLinha?.querySelectorAll('.gasto-lote-item').forEach(sel => window.atualizarBotaoExcluirItemGastoSelect(sel));
    novaLinha?.querySelectorAll('.gasto-lote-marca-select').forEach(sel => window.atualizarBotaoExcluirMarcaGasto?.(sel));
};

window.removerLinhaGastoLote = function(botao) {
    const tbody = document.getElementById('gastos-lote-rows');
    const row = botao.closest('.gasto-lote-row');
    if (!tbody || !row) return;
    if (tbody.querySelectorAll('.gasto-lote-row').length <= 1) {
        row.remove();
        tbody.insertAdjacentHTML('beforeend', window.criarLinhaGastoLoteHTML());
        return;
    }
    row.remove();
};

window.abrirModalGastosLote = function() {
    const tbody = document.getElementById('gastos-lote-rows');
    if (!tbody) return;
    if (!allGastosItens.length) {
        return window.showToast('Cadastre ao menos um item antes de lançar gastos em lote.', true);
    }

    const localSelect = document.getElementById('gasto-lote-local-unico');
    if (localSelect) localSelect.innerHTML = window.renderOptionsLocalGasto('');
    const localNovoInput = document.getElementById('gasto-lote-local-novo-input');
    if (localNovoInput) localNovoInput.style.display = 'none';
    window.atualizarBotaoExcluirLocalGasto?.(localSelect);
    const notaInput = document.getElementById('gasto-lote-nota-unica');
    if (notaInput) notaInput.value = '';
    const dataInput = document.getElementById('gasto-lote-data-unica');
    if (dataInput) dataInput.value = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

    const parcelasSelect = document.getElementById('gasto-lote-parcelas-unico');
    if (parcelasSelect) parcelasSelect.innerHTML = window.gerarOptionsParcelamento(1);

    tbody.innerHTML = window.criarLinhaGastoLoteHTML();
    tbody.querySelectorAll('.gasto-lote-item').forEach(sel => window.atualizarBotaoExcluirItemGastoSelect(sel));
    tbody.querySelectorAll('.gasto-lote-marca-select').forEach(sel => window.atualizarBotaoExcluirMarcaGasto?.(sel));
    window.openModal('modal-gastos-lote');
};

// Gera um lançamento por parcela: mesmo item/marca/local, valor total e valor unidade
// divididos igualmente, data avançando um mês por parcela, e observação com "N/total".
window.gerarPayloadsParcelasGasto = function(base, parcelas) {
    const grupoId = 'parc-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
    const valorUnidadePorParcela = (Number(base.valorUnidade) || 0) / parcelas;
    const valorTotalPorParcela = (Number(base.valorTotal) || 0) / parcelas;
    const dataBase = parseDataISO(base.dataCompra) || new Date();
    const payloads = [];

    for (let i = 1; i <= parcelas; i++) {
        const dataParcela = new Date(dataBase.getFullYear(), dataBase.getMonth() + (i - 1), dataBase.getDate());
        const dataCompraParcela = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}-${String(dataParcela.getDate()).padStart(2, '0')}`;
        const marcador = `${i}/${parcelas}`;
        const observacaoParcela = base.observacao ? `${base.observacao} (${marcador})` : marcador;

        payloads.push({
            ...base,
            valorUnidade: valorUnidadePorParcela,
            valorTotal: valorTotalPorParcela,
            dataCompra: dataCompraParcela,
            ano: dataParcela.getFullYear(),
            mes: dataParcela.getMonth() + 1,
            observacao: observacaoParcela,
            parcelaGrupoId: grupoId,
            parcelaAtual: i,
            parcelaTotal: parcelas,
            parcelaValorTotalOriginal: Number(base.valorTotal) || 0,
            parcelaValorUnidadeOriginal: Number(base.valorUnidade) || 0
        });
    }

    return payloads;
};

window.salvarGastosLote = async function() {
    const tbody = document.getElementById('gastos-lote-rows');
    if (!tbody) return;

    const localSelectUnico = document.getElementById('gasto-lote-local-unico');
    const localCompra = localSelectUnico && localSelectUnico.value !== window.SENTINELA_ADICIONAR_GASTO ? String(localSelectUnico.value || '').trim() : '';
    const notaFiscalUrl = String(document.getElementById('gasto-lote-nota-unica')?.value || '').trim();
    const dataCompra = document.getElementById('gasto-lote-data-unica')?.value || '';
    const parcelas = Math.max(1, parseInt(document.getElementById('gasto-lote-parcelas-unico')?.value || 1) || 1);

    if (!dataCompra) return window.showToast('Preencha a Data da compra (topo do formulário).', true);

    const rows = Array.from(tbody.querySelectorAll('.gasto-lote-row'));
    let salvou = 0;
    let comErro = false;

    if (localCompra) {
        try { await window.garantirLocalGasto(localCompra); } catch (e) { console.error(e); }
    }

    const dataObj = parseDataISO(dataCompra);
    const anoLote = dataObj ? dataObj.getFullYear() : new Date().getFullYear();
    const mesLote = dataObj ? dataObj.getMonth() + 1 : (new Date().getMonth() + 1);

    for (const row of rows) {
        const itemId = row.querySelector('.gasto-lote-item')?.value || '';
        const marca = String(row.querySelector('.gasto-lote-marca-select')?.value || '').trim();
        const peso = row.querySelector('.gasto-lote-peso')?.value.trim() || '';
        const quantidade = Number(row.querySelector('.gasto-lote-qtd')?.value || 0);
        const valorUnidade = Number(row.querySelector('.gasto-lote-unit')?.value || 0);
        const valorTotal = quantidade * valorUnidade;
        const comprador = row.querySelector('.gasto-lote-comprador')?.value || 'Caixa';
        const observacao = String(row.querySelector('.gasto-lote-obs')?.value || '').trim();

        const linhaVazia = !itemId && !marca && !peso && !quantidade && !valorUnidade;
        if (linhaVazia) continue;

        const item = getItemGasto(itemId);
        if (!item) { window.showToast('Selecione o item em todas as linhas preenchidas.', true); comErro = true; continue; }
        if (!marca || marca === window.SENTINELA_ADICIONAR_GASTO) { window.showToast(`Preencha a marca do item "${item.nome}".`, true); comErro = true; continue; }
        if (!quantidade || !valorUnidade) { window.showToast(`Preencha quantidade e valor unidade do item "${item.nome}".`, true); comErro = true; continue; }

        try {
            await window.garantirMarcaGasto(marca);

            const base = {
                itemId,
                itemNome: item.nome,
                nome: marca,
                marca,
                localCompra,
                peso,
                quantidade,
                valorUnidade,
                valorTotal,
                comprador,
                dataCompra,
                notaFiscalUrl,
                observacao,
                ano: anoLote,
                mes: mesLote,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };

            const payloads = parcelas > 1 ? window.gerarPayloadsParcelasGasto(base, parcelas) : [base];
            for (const payload of payloads) {
                await addDoc(collection(db, 'gastos_lancamentos'), payload);
            }
            salvou++;
        } catch (e) {
            console.error(e);
            window.showToast(`Erro ao salvar o item "${item.nome}".`, true);
            comErro = true;
        }
    }

    if (salvou) {
        window.showToast(`${salvou} lançamento(s) salvo(s)!`);
        window.atualizarSelectsMarcaGasto?.();
        window.renderGastosPlanilha();
    } else if (!comErro) {
        window.showToast('Nenhuma linha preenchida para salvar.', true);
    }

    if (salvou && !comErro) {
        window.closeModal('modal-gastos-lote');
    }
};

// ==========================================
// NOVO (2026-08): sub-abas "Gastos" (resumo) e "Lançamentos" (lista detalhada)
// Substitui o antigo comportamento de clicar no mês para abrir uma gaveta inline.
// ==========================================
window.gastosSubAbaAtiva = window.gastosSubAbaAtiva || 'gastos';

window.trocarSubAbaGastos = function(aba) {
    window.gastosSubAbaAtiva = aba;

    document.querySelectorAll('.gastos-subtab-btn').forEach(b => b.classList.toggle('active', b.dataset.subaba === aba));

    const painelResumo = document.getElementById('gastos-painel-resumo');
    const painelLanc = document.getElementById('gastos-painel-lancamentos');
    if (painelResumo) painelResumo.style.display = aba === 'gastos' ? '' : 'none';
    if (painelLanc) painelLanc.style.display = aba === 'lancamentos' ? '' : 'none';

    const titulo = document.getElementById('gastos-titulo-painel');
    if (titulo) titulo.textContent = aba === 'gastos' ? 'Planilha de Gastos' : 'Lançamentos do Período';

    // Planilha de Gastos: só o filtro de Ano. Lançamentos: Item + Período + Limpar/Exportar.
    const anoWrap = document.getElementById('gastos-filtro-ano-wrap');
    const mesWrap = document.getElementById('gastos-filtro-mes-wrap');
    const itemWrap = document.getElementById('gastos-filtro-item-wrap');
    const periodoWrap = document.getElementById('gastos-filtro-periodo-wrap');
    const acoesWrap = document.getElementById('gastos-filtros-acoes');
    if (anoWrap) anoWrap.style.display = aba === 'gastos' ? '' : 'none';
    // NOVO: filtro de Mês só faz sentido na Tabela (Planilha) - no celular, é ele que decide
    // qual dos 12 meses aparece nos cartões. No Desktop ele fica sempre escondido por CSS
    // (@media min-width:901px), então essa linha só tem efeito visível no celular.
    if (mesWrap) mesWrap.style.display = aba === 'gastos' ? '' : 'none';
    if (itemWrap) itemWrap.style.display = aba === 'lancamentos' ? '' : 'none';
    if (periodoWrap) periodoWrap.style.display = aba === 'lancamentos' ? '' : 'none';
    if (acoesWrap) acoesWrap.style.display = aba === 'lancamentos' ? '' : 'none';

    if (aba === 'lancamentos') window.renderGastosLancamentosLista();
    else window.renderGastosPlanilha();
};

// Chamado ao clicar em uma célula de mês na tabela-resumo: filtra e leva para "Lançamentos"
// (substitui a antiga window.abrirGastosItem, que ficava expandindo uma gaveta na própria linha).
window.abrirLancamentosDoMes = function(itemId, mes) {
    const selItem = document.getElementById('gastos-filtro-item');
    if (selItem) selItem.value = itemId;
    const ano = getAnoGastosSelecionado();
    window.gastosDataInicial = new Date(ano, mes - 1, 1, 0,0,0,0);
    window.gastosDataFinal = new Date(ano, mes, 0, 0,0,0,0);
    window.atualizarDisplayDataGastos?.();
    window.trocarSubAbaGastos('lancamentos');
};

// NOVO (2026-08): quando o "Local" tem um apelido/sigla entre parênteses no final
// (ex.: "Distribuidora e Panificadora (Displan)"), mostra o nome principal e o texto
// entre parênteses como uma tag menor abaixo - só formatação visual, não muda o dado salvo.
window.formatarLocalComTagGasto = function(localCompra) {
    const texto = String(localCompra || '').trim();
    if (!texto) return '-';
    const m = texto.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (!m || !m[1].trim()) return escapeHTMLGasto(texto);
    const principal = m[1].trim();
    const tag = m[2].trim();
    return `<span class="gasto-local-principal">${escapeHTMLGasto(principal)}</span><span class="gasto-local-tag">${escapeHTMLGasto(tag)}</span>`;
};

// Mesma ideia, mas em HTML simples com estilo inline (pro export Word via html-docx-js,
// que não interpreta de forma confiável classes de um <style> externo).
window.formatarLocalComTagGastoWord = function(localCompra) {
    const texto = String(localCompra || '').trim();
    if (!texto) return '';
    const m = texto.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
    if (!m || !m[1].trim()) return texto;
    const principal = m[1].trim();
    const tag = m[2].trim();
    return `${principal}<br><span style="display:inline-block; margin-top:2px; padding:1px 8px; background:#F4E6CB; color:#46493A; border-radius:8px; font-size:7pt; white-space:nowrap;">${tag}</span>`;
};

window.renderGastosLancamentosLista = function() {
    const tbody = document.getElementById('gastos-lancamentos-lista-body');
    if (!tbody) return;

    const filtroItem = document.getElementById('gastos-filtro-item')?.value || '';

    let lista = allGastosLancamentos.slice();
    if (window.gastosDataInicial && window.gastosDataFinal) {
        const ini = window.gastosDataInicial.getTime();
        const fim = window.gastosDataFinal.getTime();
        lista = lista.filter(l => {
            const d = parseDataGasto(l?.dataCompra || l?.Data_Compra || '');
            if (!d) return false;
            const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
            return t >= ini && t <= fim;
        });
    }
    if (filtroItem) lista = lista.filter(l => l.itemId === filtroItem);

    lista.sort((a, b) => {
        const porNome = String(a.itemNome || '').localeCompare(String(b.itemNome || ''), 'pt-BR', { sensitivity: 'base' });
        if (porNome !== 0) return porNome;
        return String(a.dataCompra || '').localeCompare(String(b.dataCompra || ''));
    });

    if (!lista.length) {
        tbody.innerHTML = `<tr><td colspan="12" class="gastos-empty"><i class="fas fa-box-open" style="font-size:3rem; margin-bottom:15px; display:block; color:#ddd;"></i>Nenhum lançamento neste período.</td></tr>`;
        return;
    }

    let totalGeral = 0;
    let html = '';

    lista.forEach(l => {
        const total = Number(l.valorTotal) || 0;
        totalGeral += total;
        const notaHtml = l.notaFiscalUrl
            ? `<a href="${/^https?:\/\//i.test(l.notaFiscalUrl) ? escapeHTMLGasto(l.notaFiscalUrl) : 'https://' + escapeHTMLGasto(l.notaFiscalUrl)}" target="_blank" rel="noopener" class="gastos-icon-btn copy" title="Abrir nota fiscal" onclick="event.stopPropagation();"><i class="fas fa-file-invoice"></i></a>`
            : `<span style="color:#bbb;">—</span>`;

        html += `<tr data-lanc-id="${l.id}">
            <td data-label="Item:">${escapeHTMLGasto(l.itemNome || '')}</td>
            <td data-label="Marca:">${escapeHTMLGasto(l.marca || l.nome || '')}</td>
            <td data-label="Local:">${window.formatarLocalComTagGasto(l.localCompra)}</td>
            <td data-label="Medida:">${escapeHTMLGasto(l.peso || '-')}</td>
            <td data-label="Quantidade:">${(Number(l.quantidade) || 0).toLocaleString('pt-BR')}</td>
            <td data-label="Unidade:">${formatarMoedaGasto(l.valorUnidade)}</td>
            <td data-label="Total:"><strong>${formatarMoedaGasto(total)}</strong></td>
            <td data-label="Comprador:">${escapeHTMLGasto(l.comprador || '-')}</td>
            <td data-label="Data:">${window.formatarDataCurtaGasto(l.dataCompra)}</td>
            <td data-label="Nota Fiscal:">${notaHtml}</td>
            <td data-label="Observação:">${escapeHTMLGasto(l.observacao || '-')}</td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" title="Editar lançamento" onclick="window.abrirEdicaoLancamentoGasto('${l.id}')"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action copy" title="Copiar lançamento" onclick="window.copiarLancamentoGasto('${l.id}')"><i class="fas fa-copy"></i></button>
                    <button class="btn-action del" title="Excluir lançamento" onclick="window.excluirLancamentoGasto('${l.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });

    // NOVO (2026-08): total do período volta a ser a última linha da tabela, mas fixa
    // (sticky) no fim da área visível - os itens rolam entre ela e o cabeçalho (thead,
    // que já é sticky no topo). Classe própria (não .gastos-total-row, usada na Planilha).
    html += `<tr class="gastos-lancamentos-total-row">
        <td colspan="11">TOTAL DO PERÍODO</td>
        <td><strong>${formatarMoedaGasto(totalGeral)}</strong></td>
    </tr>`;

    tbody.innerHTML = html;
};

window.montarOptionsItensGasto = function(selecionado = '') {
    const itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    let html = `<option value="${window.SENTINELA_ADICIONAR_GASTO}">+ Adicionar item</option>`;
    itens.forEach(i => { html += `<option value="${i.id}" ${i.id === selecionado ? 'selected' : ''}>${escapeHTMLGasto(i.nome)}</option>`; });
    return html;
};

window.abrirEdicaoLancamentoGasto = function(lancId) {
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;

    document.getElementById('edit-lanc-id').value = l.id;
    const selItem = document.getElementById('edit-lanc-item');
    const selMarca = document.getElementById('edit-lanc-marca');
    const selLocal = document.getElementById('edit-lanc-local');
    selItem.innerHTML = window.montarOptionsItensGasto(l.itemId);
    selMarca.innerHTML = window.renderOptionsMarcaGasto(l.marca || l.nome || '');
    selLocal.innerHTML = window.renderOptionsLocalGasto(l.localCompra || '');
    document.getElementById('edit-lanc-peso').value = l.peso || '';
    document.getElementById('edit-lanc-qtd').value = l.quantidade || 1;
    document.getElementById('edit-lanc-unit').value = l.valorUnidade || 0;
    document.getElementById('edit-lanc-comprador').value = l.comprador || 'Caixa';
    document.getElementById('edit-lanc-data').value = l.dataCompra || '';
    document.getElementById('edit-lanc-nota').value = l.notaFiscalUrl || '';
    document.getElementById('edit-lanc-obs').value = l.observacao || '';

    const parcelaHint = document.getElementById('edit-lanc-parcela-hint');
    const parcelasWrap = document.getElementById('edit-lanc-parcelas-wrap');
    const parcelasSelect = document.getElementById('edit-lanc-parcelas');
    const ehParcelado = !!(l.parcelaGrupoId && l.parcelaTotal > 1);
    if (parcelasWrap) parcelasWrap.style.display = ehParcelado ? '' : 'none';
    if (parcelasSelect) parcelasSelect.innerHTML = window.gerarOptionsParcelas(ehParcelado ? l.parcelaTotal : 2);
    if (parcelaHint) parcelaHint.textContent = ehParcelado ? `(atualmente parcela ${l.parcelaAtual || 1}/${l.parcelaTotal})` : '';

    const novoItemInput = document.getElementById('edit-lanc-item-novo-input');
    if (novoItemInput) novoItemInput.style.display = 'none';
    const novaMarcaInput = document.getElementById('edit-lanc-marca-novo-input');
    if (novaMarcaInput) novaMarcaInput.style.display = 'none';
    const novoLocalInput = document.getElementById('edit-lanc-local-novo-input');
    if (novoLocalInput) novoLocalInput.style.display = 'none';
    window.atualizarBotaoExcluirItemGastoSelect(selItem);
    window.atualizarBotaoExcluirMarcaGasto?.(selMarca);
    window.atualizarBotaoExcluirLocalGasto?.(selLocal);

    window.openModal('modal-editar-gasto-lancamento');
};

window.__edicaoParcelaPendente = null;

window.salvarEdicaoLancamentoGasto = async function(event) {
    event.preventDefault();
    const lancId = document.getElementById('edit-lanc-id').value;
    const l = allGastosLancamentos.find(x => x.id === lancId);
    if (!l) return;

    const itemId = document.getElementById('edit-lanc-item').value;
    const item = getItemGasto(itemId);
    if (!item) return window.showToast('Selecione um item válido.', true);

    const marca = String(document.getElementById('edit-lanc-marca').value || '').trim();
    const localCompra = String(document.getElementById('edit-lanc-local').value || '').trim();
    const peso = document.getElementById('edit-lanc-peso').value.trim();
    const quantidade = Number(document.getElementById('edit-lanc-qtd').value || 0);
    const valorUnidade = Number(document.getElementById('edit-lanc-unit').value || 0);
    const valorTotal = quantidade * valorUnidade;
    const comprador = document.getElementById('edit-lanc-comprador').value || 'Caixa';
    const dataCompra = document.getElementById('edit-lanc-data').value;
    const notaFiscalUrl = document.getElementById('edit-lanc-nota').value.trim();
    const observacao = document.getElementById('edit-lanc-obs').value.trim();

    if (!marca || marca === window.SENTINELA_ADICIONAR_GASTO) return window.showToast('Selecione ou cadastre uma marca.', true);
    if (!quantidade || !valorUnidade) return window.showToast('Preencha quantidade e valor unidade.', true);
    if (!dataCompra) return window.showToast('Preencha a data.', true);

    const dados = { lancId, l, itemId, item, marca, localCompra, peso, quantidade, valorUnidade, valorTotal, comprador, dataCompra, notaFiscalUrl, observacao };

    const ehParcelado = !!(l.parcelaGrupoId && l.parcelaTotal > 1);
    const novoTotalParcelas = ehParcelado ? Number(document.getElementById('edit-lanc-parcelas')?.value || l.parcelaTotal) : 0;
    const parcelasMudou = ehParcelado && novoTotalParcelas !== Number(l.parcelaTotal);

    if (parcelasMudou) {
        return await window.alterarQuantidadeParcelasGasto(dados, novoTotalParcelas);
    }

    const valorMudou = Math.abs(valorTotal - (Number(l.valorTotal) || 0)) > 0.004;
    if (ehParcelado && valorMudou) {
        window.__edicaoParcelaPendente = dados;
        window.openModal('modal-escolha-parcela');
        return;
    }

    await window.salvarEdicaoLancamentoGastoDefinitivo(dados);
};

window.confirmarEdicaoParcela = async function(modo) {
    const dados = window.__edicaoParcelaPendente;
    window.__edicaoParcelaPendente = null;
    window.closeModal('modal-escolha-parcela');
    if (!dados) return;

    if (modo === 'total') await window.redistribuirParcelasGasto(dados);
    else await window.salvarEdicaoLancamentoGastoDefinitivo(dados);
};

window.salvarEdicaoLancamentoGastoDefinitivo = async function(dados) {
    const { lancId, l, itemId, item, marca, localCompra, peso, quantidade, valorUnidade, valorTotal, comprador, dataCompra, notaFiscalUrl, observacao } = dados;
    try {
        await window.garantirMarcaGasto(marca);
        if (localCompra) await window.garantirLocalGasto(localCompra);
        const dataObj = parseDataISO(dataCompra);

        await updateDoc(doc(db, 'gastos_lancamentos', lancId), {
            itemId,
            itemNome: item.nome,
            nome: marca,
            marca,
            localCompra,
            peso,
            quantidade,
            valorUnidade,
            valorTotal,
            comprador,
            dataCompra,
            notaFiscalUrl,
            observacao,
            ano: dataObj ? dataObj.getFullYear() : l.ano,
            mes: dataObj ? dataObj.getMonth() + 1 : l.mes,
            updatedAt: Date.now()
        });

        window.showToast('Lançamento atualizado!');
        window.atualizarSelectsMarcaGasto?.();
        window.closeModal('modal-editar-gasto-lancamento');
        window.renderGastosPlanilha();
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao atualizar lançamento.', true);
    }
};

// Trata o valor editado como o novo TOTAL da compra parcelada: recalcula e regrava
// o valor de cada parcela do mesmo grupo (mantém a data/mês de cada parcela intacta).
window.redistribuirParcelasGasto = async function(dados) {
    const { l, itemId, item, marca, localCompra, peso, quantidade, valorUnidade, valorTotal, comprador, notaFiscalUrl, observacao } = dados;
    const grupoId = l.parcelaGrupoId;
    if (!grupoId) return window.salvarEdicaoLancamentoGastoDefinitivo(dados);

    const membros = allGastosLancamentos.filter(x => x.parcelaGrupoId === grupoId).sort((a, b) => (a.parcelaAtual || 0) - (b.parcelaAtual || 0));
    const totalParcelas = l.parcelaTotal || membros.length || 1;
    const novoValorUnidadePorParcela = (Number(valorUnidade) || 0) / totalParcelas;
    const novoValorTotalPorParcela = (Number(valorTotal) || 0) / totalParcelas;

    try {
        await window.garantirMarcaGasto(marca);
        if (localCompra) await window.garantirLocalGasto(localCompra);

        await Promise.all(membros.map(m => {
            const marcador = `${m.parcelaAtual || 1}/${totalParcelas}`;
            const obsFinal = observacao ? `${observacao} (${marcador})` : marcador;
            return updateDoc(doc(db, 'gastos_lancamentos', m.id), {
                itemId,
                itemNome: item.nome,
                nome: marca,
                marca,
                localCompra,
                peso,
                quantidade,
                valorUnidade: novoValorUnidadePorParcela,
                valorTotal: novoValorTotalPorParcela,
                comprador,
                notaFiscalUrl,
                observacao: obsFinal,
                parcelaValorTotalOriginal: Number(valorTotal) || 0,
                parcelaValorUnidadeOriginal: Number(valorUnidade) || 0,
                updatedAt: Date.now()
            });
        }));

        window.showToast(`Valor total redistribuído entre as ${totalParcelas} parcelas!`);
        window.atualizarSelectsMarcaGasto?.();
        window.closeModal('modal-editar-gasto-lancamento');
        window.renderGastosPlanilha();
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao redistribuir parcelas.', true);
    }
};

// Altera a QUANTIDADE de parcelas de um lançamento já parcelado: revalida/redistribui o
// valor total (editado) entre o novo número de parcelas — cria lançamentos novos se o
// número aumentou, ou remove os excedentes (as últimas parcelas) se diminuiu. As parcelas
// mantidas preservam sua própria data/mês; as novas continuam a cadência mensal a partir
// da data da parcela 1.
window.alterarQuantidadeParcelasGasto = async function(dados, novoTotalParcelas) {
    const { l, itemId, item, marca, localCompra, peso, quantidade, valorUnidade, valorTotal, comprador, notaFiscalUrl, observacao } = dados;
    const grupoId = l.parcelaGrupoId;
    if (!grupoId) return window.salvarEdicaoLancamentoGastoDefinitivo(dados);

    const membrosAtuais = allGastosLancamentos.filter(x => x.parcelaGrupoId === grupoId).sort((a, b) => (a.parcelaAtual || 0) - (b.parcelaAtual || 0));
    const totalAtual = membrosAtuais.length;
    const novoValorUnidadePorParcela = (Number(valorUnidade) || 0) / novoTotalParcelas;
    const novoValorTotalPorParcela = (Number(valorTotal) || 0) / novoTotalParcelas;
    const primeiraParcela = membrosAtuais.find(m => Number(m.parcelaAtual) === 1) || membrosAtuais[0];
    const dataBase = parseDataISO(primeiraParcela?.dataCompra) || new Date();

    try {
        await window.garantirMarcaGasto(marca);
        if (localCompra) await window.garantirLocalGasto(localCompra);

        const manter = membrosAtuais.slice(0, novoTotalParcelas);
        const remover = membrosAtuais.slice(novoTotalParcelas);

        await Promise.all(manter.map(m => {
            const marcador = `${m.parcelaAtual || 1}/${novoTotalParcelas}`;
            const obsFinal = observacao ? `${observacao} (${marcador})` : marcador;
            return updateDoc(doc(db, 'gastos_lancamentos', m.id), {
                itemId, itemNome: item.nome, nome: marca, marca, localCompra, peso, quantidade,
                valorUnidade: novoValorUnidadePorParcela,
                valorTotal: novoValorTotalPorParcela,
                comprador, notaFiscalUrl, observacao: obsFinal,
                parcelaTotal: novoTotalParcelas,
                parcelaValorTotalOriginal: Number(valorTotal) || 0,
                parcelaValorUnidadeOriginal: Number(valorUnidade) || 0,
                updatedAt: Date.now()
            });
        }));

        if (remover.length) {
            await Promise.all(remover.map(m => deleteDoc(doc(db, 'gastos_lancamentos', m.id))));
        }

        for (let i = totalAtual + 1; i <= novoTotalParcelas; i++) {
            const dataParcela = new Date(dataBase.getFullYear(), dataBase.getMonth() + (i - 1), dataBase.getDate());
            const dataCompraParcela = `${dataParcela.getFullYear()}-${String(dataParcela.getMonth() + 1).padStart(2, '0')}-${String(dataParcela.getDate()).padStart(2, '0')}`;
            const marcador = `${i}/${novoTotalParcelas}`;
            const obsFinal = observacao ? `${observacao} (${marcador})` : marcador;
            await addDoc(collection(db, 'gastos_lancamentos'), {
                itemId, itemNome: item.nome, nome: marca, marca, localCompra, peso, quantidade,
                valorUnidade: novoValorUnidadePorParcela,
                valorTotal: novoValorTotalPorParcela,
                comprador, notaFiscalUrl, observacao: obsFinal,
                dataCompra: dataCompraParcela,
                ano: dataParcela.getFullYear(),
                mes: dataParcela.getMonth() + 1,
                parcelaGrupoId: grupoId,
                parcelaAtual: i,
                parcelaTotal: novoTotalParcelas,
                parcelaValorTotalOriginal: Number(valorTotal) || 0,
                parcelaValorUnidadeOriginal: Number(valorUnidade) || 0,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        }

        window.showToast(`Parcelamento atualizado para ${novoTotalParcelas}x!`);
        window.atualizarSelectsMarcaGasto?.();
        window.closeModal('modal-editar-gasto-lancamento');
        window.renderGastosPlanilha();
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao alterar a quantidade de parcelas.', true);
    }
};

// Toda vez que a planilha-resumo é atualizada (qualquer alteração em itens/lançamentos/marcas),
// mantém a lista de Lançamentos sincronizada também, se ela for a sub-aba ativa no momento.
const renderGastosPlanilhaComSubAbasOriginal = window.renderGastosPlanilha;
window.renderGastosPlanilha = function(...args) {
    const retorno = renderGastosPlanilhaComSubAbasOriginal.apply(this, args);
    if (window.gastosSubAbaAtiva === 'lancamentos') window.renderGastosLancamentosLista?.();
    window.atualizarDisplayDataGastos?.();
    // Mobile: marca no <table> qual mês está ativo no filtro, para o CSS mostrar só essa
    // coluna de mês (junto com a coluna de Item, fixa) e esconder as outras 11.
    const tabelaResumoGastos = document.querySelector('#gastos-painel-resumo table.gastos-rebuild-table');
    if (tabelaResumoGastos) {
        // NOVO: o mês mostrado no celular agora vem do filtro de Mês (#gastos-mes-filtro,
        // visível no popup de Filtros da aba Tabela). Continua caindo no mês atual real
        // por padrão, já que o select já nasce com esse valor selecionado.
        const mesFiltroSelecionado = document.getElementById('gastos-mes-filtro')?.value;
        tabelaResumoGastos.setAttribute('data-mes-ativo', String(mesFiltroSelecionado || new Date().getMonth() + 1));
    }
    return retorno;
};

// --- Filtro/exportação de mês ---
(function initGastosMesFiltroSelect() {
    const sel = document.getElementById('gastos-mes-filtro');
    if (!sel) return;
    const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    sel.innerHTML = nomes.map((n, i) => `<option value="${i + 1}">Mês: ${n}</option>`).join('');
    sel.value = String(new Date().getMonth() + 1);
})();

window.prepararDadosExportacaoGastos = function() {
    const itemFiltro = document.getElementById('gastos-filtro-item')?.value || '';
    const ini = window.gastosDataInicial;
    const fim = window.gastosDataFinal || ini;

    const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    const fmtArquivo = (d) => `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    const mesmaData = ini && fim && ini.getTime() === fim.getTime();
    const periodoLabel = ini ? (mesmaData ? fmt(ini) : `${fmt(ini)} - ${fmt(fim)}`) : '';
    const periodoArquivo = ini ? (mesmaData ? fmtArquivo(ini) : `${fmtArquivo(ini)}_a_${fmtArquivo(fim)}`) : 'periodo';

    let itens = [...allGastosItens].sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
    if (itemFiltro) itens = itens.filter(i => i.id === itemFiltro);

    const grupos = [];
    let totalGeral = 0;

    itens.forEach(item => {
        let lista = allGastosLancamentos.filter(l => l.itemId === item.id);
        if (ini && fim) {
            const t0 = ini.getTime(), t1 = fim.getTime();
            lista = lista.filter(l => {
                const d = parseDataGasto(l?.dataCompra || l?.Data_Compra || '');
                if (!d) return false;
                const t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
                return t >= t0 && t <= t1;
            });
        }
        lista.sort((a, b) => String(a.dataCompra || '').localeCompare(String(b.dataCompra || '')));
        if (!lista.length) return;
        const totalItem = lista.reduce((acc, l) => acc + (Number(l.valorTotal) || 0), 0);
        totalGeral += totalItem;
        grupos.push({ item, lista, totalItem });
    });

    return { periodoLabel, periodoArquivo, grupos, totalGeral, temDados: grupos.length > 0 };
};

// Botão "Exportar Mês": abre um popup de escolha (WhatsApp Arabela/Flávio ou Word), em vez de baixar direto.
window.abrirModalExportarGastos = function() {
    const dados = window.prepararDadosExportacaoGastos();
    if (!dados.temDados) return window.showToast(`Nenhum gasto lançado no período selecionado.`, true);

    const periodoEl = document.getElementById('gastos-exportar-periodo');
    if (periodoEl) periodoEl.textContent = dados.periodoLabel;

    window.openModal('modal-exportar-gastos');
};

window.enviarGastosMesWA = function(destinatario) {
    const dados = window.prepararDadosExportacaoGastos();
    if (!dados.temDados) return window.showToast('Nada para exportar.', true);

    const normalizar = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    const numerosGastosWA = { arabela: '558199502865', ara: '558199502865', flavio: '558199591775', fla: '558199591775', flávio: '558199591775' };
    const numero = numerosGastosWA[normalizar(destinatario)];
    if (!numero) return window.showToast('Não foi possível identificar o número do destinatário.', true);

    const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let txt = `*FAVU - Gastos do Período*\n`;
    txt += `*${dados.periodoLabel}*\n\n`;

    dados.grupos.forEach(g => {
        txt += `*${g.item.nome} | Valor Total: ${moeda(g.totalItem)}*\n`;
        g.lista.forEach(l => {
            const marca = l.marca || l.nome || '';
            txt += `- Marca: ${marca}\n`;
            txt += `- Local: ${l.localCompra || '-'}\n`;
            txt += `- Medidas: ${l.peso || '-'}\n`;
            txt += `- Quantidade: ${(Number(l.quantidade) || 0).toLocaleString('pt-BR')}\n`;
            txt += `- Valor: ${moeda(l.valorTotal)}\n`;
            txt += `- Data: ${window.formatarDataCurtaGasto(l.dataCompra)}\n`;
            if (l.observacao) txt += `- Observação: ${l.observacao}\n`;
            txt += `\n`;
        });
    });

    txt += `*-------------------------------------*\n`;
    txt += `*TOTAL GERAL: ${moeda(dados.totalGeral)}*`;

    window.open(`https://api.whatsapp.com/send?phone=${numero}&text=${encodeURIComponent(txt)}`, '_blank');
    window.closeModal('modal-exportar-gastos');
};

// Carrega sob demanda uma biblioteca leve de conversão HTML → Word (só quando o botão "Word" é usado).
window.__htmlDocxJsPromise = null;
window.carregarHtmlDocxJs = function() {
    if (window.htmlDocx) return Promise.resolve();
    if (window.__htmlDocxJsPromise) return window.__htmlDocxJsPromise;
    window.__htmlDocxJsPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html-docx-js/dist/html-docx.min.js';
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Falha ao carregar biblioteca de exportação Word.'));
        document.head.appendChild(script);
    });
    return window.__htmlDocxJsPromise;
};

// Carrega o logo FAVU sob demanda e converte para base64, para embutir no .docx (arquivo autossuficiente).
window.__favuLogoBase64 = null;
window.carregarLogoFavuBase64 = async function() {
    if (window.__favuLogoBase64) return window.__favuLogoBase64;
    try {
        const resp = await fetch('./images/favu.png');
        const blob = await resp.blob();
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        window.__favuLogoBase64 = base64;
        return base64;
    } catch (e) {
        console.warn('Não foi possível carregar o logo FAVU para o Word:', e);
        return null;
    }
};

// Modelo padrão FAVU Cozinha Afetiva para documentos Word: logo + cores da marca (moss/rust),
// tabela com colunas de largura igual ocupando 100% da página (altura cresce, largura não).
window.exportarGastosWord = async function() {
    const dados = window.prepararDadosExportacaoGastos();
    if (!dados.temDados) return window.showToast('Nada para exportar.', true);

    window.showToast('Preparando arquivo Word...');

    try {
        await window.carregarHtmlDocxJs();
    } catch (e) {
        console.error(e);
        return window.showToast('Não foi possível carregar o gerador de Word. Verifique a conexão.', true);
    }

    const logoBase64 = await window.carregarLogoFavuBase64();
    const moeda = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const colunas = ['Marca', 'Local', 'Medida', 'Quantidade', 'Unidade', 'Total', 'Comprador', 'Data', 'Nota Fiscal', 'Observação'];
    const larguraColuna = (100 / colunas.length).toFixed(2);
    const theadHtml = `<tr>${colunas.map(c => `<th style="width:${larguraColuna}%;">${c}</th>`).join('')}</tr>`;

    const cabecalhoHtml = `
        <table style="width:100%; border:none; border-collapse:collapse; margin-bottom:4px;">
            <tr>
                <td style="border:none; width:100px; vertical-align:middle;">${logoBase64 ? `<img src="${logoBase64}" width="96" height="57" style="width:96px; height:57px;">` : `<span style="font-size:16pt; font-weight:bold; color:#1D2814;">FAVU</span>`}</td>
                <td style="border:none; text-align:right; vertical-align:middle;">
                    <div style="font-size:14pt; font-weight:bold; color:#E09F41; font-family:'Segoe UI', Arial, sans-serif;">Gastos do Período</div>
                    <div style="font-size:9pt; color:#46493A; font-family:'Segoe UI', Arial, sans-serif;">${dados.periodoLabel}</div>
                </td>
            </tr>
        </table>
        <div style="border-top:2px solid #E09F41; margin-bottom:8px;"></div>`;

    let corpo = cabecalhoHtml;

    dados.grupos.forEach(g => {
        corpo += `<div style="background:#1D2814; color:#ffffff; padding:4px 8px; font-size:9.5pt; font-weight:bold; font-family:'Segoe UI', Arial, sans-serif; margin-top:8px;">${g.item.nome} — ${moeda(g.totalItem)}</div>`;
        corpo += `<table style="table-layout:fixed; width:100%; border-collapse:collapse; margin-bottom:4px; font-family:'Segoe UI', Arial, sans-serif;">
            <thead>${theadHtml}</thead>
            <tbody>`;
        g.lista.forEach(l => {
            const notaUrl = String(l.notaFiscalUrl || '').trim();
            const notaHref = notaUrl ? (/^https?:\/\//i.test(notaUrl) ? notaUrl : `https://${notaUrl}`) : '';
            const notaCell = notaUrl
                ? `<a href="${notaHref}" style="display:inline-block; padding:0px 6px; background:#E09F41; color:#ffffff; border-radius:8px; text-decoration:none; font-size:6.5pt; white-space:nowrap;">Nota</a>`
                : '';
            corpo += `<tr>
                <td>${l.marca || l.nome || ''}</td>
                <td>${window.formatarLocalComTagGastoWord(l.localCompra)}</td>
                <td>${l.peso || ''}</td>
                <td>${(Number(l.quantidade) || 0).toLocaleString('pt-BR')}</td>
                <td>${moeda(l.valorUnidade)}</td>
                <td>${moeda(l.valorTotal)}</td>
                <td>${l.comprador || ''}</td>
                <td>${window.formatarDataCurtaGasto(l.dataCompra)}</td>
                <td>${notaCell}</td>
                <td>${l.observacao || ''}</td>
            </tr>`;
        });
        corpo += `</tbody></table>`;
    });

    corpo += `<div style="background:#E09F41; color:#1D2814; padding:6px; font-size:11pt; font-weight:bold; text-align:right; font-family:'Segoe UI', Arial, sans-serif; margin-top:8px;">TOTAL GERAL: ${moeda(dados.totalGeral)}</div>`;

    const estilos = `
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; color: #1D2814; font-size: 7.5pt; line-height: 1.1; }
            table { table-layout: fixed; width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #46493A; padding: 2px 3px; text-align: left; font-size: 7.5pt; word-wrap: break-word; overflow-wrap: break-word; vertical-align: top; line-height: 1.1; }
            th { background: #1D2814; color: #ffffff; font-size: 7.5pt; padding: 3px; }
        </style>`;
    const htmlCompleto = `<!DOCTYPE html><html><head><meta charset="utf-8">${estilos}</head><body>${corpo}</body></html>`;

    try {
        // Paisagem + margens menores (0,5") = mais colunas cabem por linha e menos texto
        // quebra em 2+ linhas por célula, reduzindo ainda mais o total de páginas.
        const blob = window.htmlDocx.asBlob(htmlCompleto, {
            orientation: 'landscape',
            margins: { top: 720, bottom: 720, left: 720, right: 720, header: 360, footer: 360, gutter: 0 }
        });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Gastos_${dados.periodoArquivo}.docx`;
        link.click();
        window.showToast('Download iniciado!');
        window.closeModal('modal-exportar-gastos');
    } catch (e) {
        console.error(e);
        window.showToast('Erro ao gerar o arquivo Word.', true);
    }
};

// Export antigo em CSV — mantido intacto (não é mais chamado pelo botão, que agora abre o popup acima),
// disponível caso seja necessário reativar rapidamente.
window.exportarGastosMesCSV = function() {
    const dados = window.prepararDadosExportacaoGastos ? window.prepararDadosExportacaoGastos() : null;
    const mes = dados ? dados.mes : Number(document.getElementById('gastos-mes-filtro')?.value || (new Date().getMonth() + 1));
    const ano = dados ? dados.ano : Number(document.getElementById('gastos-ano')?.value || new Date().getFullYear());
    const nomeMes = dados ? dados.nomeMes : (window.GASTOS_NOMES_MESES[mes - 1] || '');

    if (!dados || !dados.temDados) {
        return window.showToast(`Nenhum gasto lançado em ${nomeMes}/${ano}.`, true);
    }

    const linhas = [];
    dados.grupos.forEach(({ item, lista, totalItem }) => {
        lista.forEach(l => {
            const total = Number(l.valorTotal) || 0;
            linhas.push([
                item.nome || '',
                l.marca || l.nome || '',
                l.localCompra || '',
                l.peso || '',
                String(l.quantidade || 0).replace('.', ','),
                (Number(l.valorUnidade) || 0).toFixed(2).replace('.', ','),
                total.toFixed(2).replace('.', ','),
                l.comprador || '',
                l.dataCompra || '',
                l.notaFiscalUrl || ''
            ]);
        });
        linhas.push([`Subtotal ${item.nome}`, '', '', '', '', '', totalItem.toFixed(2).replace('.', ','), '', '', '']);
        linhas.push([]);
    });

    const cabecalho = ['Item', 'Marca', 'Local de Compra', 'Medida', 'Quantidade', 'Unidade', 'Valor Total', 'Comprador', 'Data', 'Nota Fiscal'];
    const escaparCSV = (valor) => {
        const texto = String(valor === undefined || valor === null ? '' : valor);
        return /[",;\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
    };

    let csv = cabecalho.map(escaparCSV).join(',') + '\n';
    linhas.forEach(linha => { csv += linha.map(escaparCSV).join(',') + '\n'; });
    csv += ['TOTAL GERAL', '', '', '', '', '', dados.totalGeral.toFixed(2).replace('.', ','), '', '', ''].map(escaparCSV).join(',') + '\n';

    const blob = new Blob(["﻿" + csv], { type: 'text/csv;charset=utf-8;' }); // "﻿" resolve acentos no Excel (BOM)
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Gastos_${nomeMes}_${ano}.csv`;
    link.click();

    window.showToast('Download iniciado!');
};

