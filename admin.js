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
let allAvisos = [];
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
    'Aguardando Retirada',
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

window.customAlert = function(msg, title = "Sucesso!") {
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
// UPLOAD DE IMAGEM SEGURO (FIREBASE STORAGE)
// ==========================================
async function upImg(file) {
    try {
        const filename = `imagens/${Date.now()}_${file.name}`;
        const storageRef = ref(storage, filename);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch(e) { 
        console.error("Erro no upload:", e);
        customAlert("Erro no upload da imagem.", "Atenção"); 
        return ""; 
    }
}

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

window.markImageForRemoval = function(type) {
    if(type === 'prod') {
        document.getElementById('e-img-preview').style.display = 'none'; document.getElementById('e-img-preview').src = '';
        document.getElementById('btn-remove-e-img').style.display = 'none'; document.getElementById('e-img-none').style.display = 'block';
        document.getElementById('e-file').value = ''; document.getElementById('e-file-name').textContent = '';
        document.getElementById('e-remove-img').value = 'true';
    } else if (type === 'aviso') {
        document.getElementById('ea-img-preview').style.display = 'none'; document.getElementById('ea-img-preview').src = '';
        document.getElementById('btn-remove-ea-img').style.display = 'none'; document.getElementById('ea-img-none').style.display = 'block';
        document.getElementById('ea-file').value = ''; document.getElementById('ea-file-name').textContent = '';
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
    document.getElementById(`count-${type}`).textContent = checked;
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

async function syncCats() {
    const snap = await getDocs(collection(db, "categorias"));
    globalCategories = []; snap.forEach(d => { const c = d.data(); c.id = d.id; globalCategories.push(c); });
    window.renderCatsTable();
}

window.renderCatsTable = function() {
    const tb = document.querySelector('#tbl-categorias tbody'); tb.innerHTML = "";
    let opts = `<option value="">Selecione...</option>`;
    const searchTerm = document.getElementById('search-cat').value.toLowerCase();
    
    const sorted = globalCategories.sort((a, b) => window.sortAlfabetico(a.nome, b.nome));
    sorted.forEach(c => { opts += `<option value="${c.nome}">${c.nome}</option>`; });

    sorted.filter(c => `${c.nome} ${c.minTotal||0} ${c.tipoColuna} ${c.mensagemObs||''} ${c.ativo?'ativa':'oculta'}`.toLowerCase().includes(searchTerm)).forEach(c => {
        const isAtivo = c.ativo !== false; 
        tb.innerHTML += `<tr>
            <td data-label="Sel:" style="text-align: center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${c.id}" onchange="window.checkSelection('categorias')"></td>
            <td data-label="Categoria:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${c.nome}</strong></td>
            <td data-label="Mín. Total:">${c.minTotal}</td><td data-label="Exibição:">${c.tipoColuna}</td>
            <td data-label="Aviso Destacado:"><small>${c.mensagemObs || '-'}</small></td>
            <td data-label="Status:"><span class="badge ${isAtivo ? 'ativo' : 'inativo'}">${isAtivo ? 'Ativa' : 'Oculta'}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditCat('${c.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-action toggle" onclick="window.togC('${c.id}', ${!isAtivo})"><i class="fas fa-${isAtivo?'eye':'eye-slash'}"></i></button>
                    <button class="btn-action del" onclick="window.delC('${c.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
    document.querySelectorAll('.cat-select').forEach(sel => { const v = sel.value; sel.innerHTML = opts; sel.value = v; });
}

document.getElementById('form-add-cat').onsubmit = async(e) => {
    e.preventDefault(); const nm = document.getElementById('ac-nome').value.trim();
    await setDoc(doc(db, "categorias", nm.toLowerCase().replace(/\s/g, '-')), { nome: nm, minTotal: parseInt(document.getElementById('ac-min').value)||0, tipoColuna: document.getElementById('ac-col').value, mensagemObs: document.getElementById('ac-obs').value.trim(), ativo: true, minIndividual: true }); 
    customAlert("Categoria Criada!"); window.closeModal('modal-add-cat', 'form-add-cat'); syncCats();
};

window.openEditCat = async(id) => {
    const c = (await getDoc(doc(db, "categorias", id))).data();
    document.getElementById('ec-id').value = id; document.getElementById('ec-nome').value = c.nome;
    document.getElementById('ec-min').value = c.minTotal; document.getElementById('ec-col').value = c.tipoColuna;
    document.getElementById('ec-obs').value = c.mensagemObs || ''; window.openModal('modal-editar-cat');
};

document.getElementById('form-edit-cat').onsubmit = async(e) => {
    e.preventDefault();
    await updateDoc(doc(db, "categorias", document.getElementById('ec-id').value), { nome: document.getElementById('ec-nome').value.trim(), minTotal: parseInt(document.getElementById('ec-min').value)||0, tipoColuna: document.getElementById('ec-col').value, mensagemObs: document.getElementById('ec-obs').value.trim() });
    customAlert("Categoria Atualizada!"); window.closeModal('modal-editar-cat', 'form-edit-cat'); syncCats(); loadProds();
};
window.togC = async(id, s) => { await updateDoc(doc(db, "categorias", id), {ativo: s}); syncCats(); };
window.delC = async(id) => { customConfirm("Excluir categoria?", async () => { await deleteDoc(doc(db, "categorias", id)); syncCats(); loadProds(); }); };

document.getElementById('a-cat').addEventListener('change', function() {
    const catObj = globalCategories.find(c => c.nome === this.value);
    const isSizeCategory = catObj && catObj.tipoColuna === 'Tamanho';
    document.getElementById('variations-container').innerHTML = '';
    window.addVariation(isSizeCategory);
    document.getElementById('btn-add-variation').style.display = isSizeCategory ? 'block' : 'none';
});

window.addVariation = (isSizeCategory = true) => {
    const container = document.getElementById('variations-container');
    if (!container) return; 
    const div = document.createElement('div');
    div.className = 'variation-block';
    div.style = "background: rgba(224, 159, 65, 0.05); padding: 15px; border-radius: 10px; margin-bottom: 15px; border: 1px dashed rgba(224, 159, 65, 0.3); position: relative;";
    const btnRemove = (isSizeCategory && container.children.length > 0) ? `<button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: white; color: #E60000; border: 1px solid #E60000; border-radius: 5px; font-size: 0.8rem; cursor: pointer; padding: 2px 8px;">Remover <i class="fas fa-times"></i></button>` : '';
    const sizeFieldHtml = isSizeCategory ? `<div><label>Tamanho</label><input type="text" class="v-tam" placeholder="Ex: (P - 1,5kg)" required></div>` : `<div style="display:none;"><input type="hidden" class="v-tam" value=""></div>`;

    div.innerHTML = `${btnRemove}
        <div class="form-grid" style="grid-template-columns: ${isSizeCategory ? '1fr 1fr' : '1fr'}; margin-bottom: 10px;">
            ${sizeFieldHtml}<div><label>Preço (R$)</label><input type="number" step="0.01" class="v-preco" required style="font-family: var(--font-numbers) !important;"></div>
        </div>
        <div><label>Descrição do Resumo</label><textarea class="v-dres" rows="1" required placeholder="Descrição para o resumo"></textarea></div>`;
    container.appendChild(div);
};

document.getElementById('form-add-prod').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        let url = ""; const f = document.getElementById('a-file').files[0]; if(f) url = await upImg(f);
        const nomeBase = document.getElementById('a-nome').value.trim();
        const categoriaBase = document.getElementById('a-cat').value;
        const minBase = parseInt(document.getElementById('a-min').value)||1;
        const descMenuBase = document.getElementById('a-dmenu').value.trim();
        const descPopupBase = document.getElementById('a-dpop').value.trim();

        for(let v of document.querySelectorAll('.variation-block')) {
            await addDoc(collection(db, "produtos"), {
                nome: nomeBase, categoria: categoriaBase, min: minBase, 
                descricaoItem: descMenuBase, descricaoPopup: descPopupBase, 
                imagemUrl: url, ativo: true, tamanho: v.querySelector('.v-tam').value.trim(), 
                preco: parseFloat(v.querySelector('.v-preco').value)||0, descricaoResumo: v.querySelector('.v-dres').value.trim()
            });
        }
        customAlert("Item(ns) Adicionado(s)!"); window.closeModal('modal-add-prod', 'form-add-prod'); loadProds();
    } catch(err) { console.error(err); customAlert("Erro ao salvar.", "Erro"); } finally { btn.innerHTML = 'Salvar Novo Produto'; btn.disabled = false; }
};

window.handleBulkCategoryChange = (selectElement) => {
    const catObj = globalCategories.find(c => c.nome === selectElement.value);
    const container = selectElement.closest('.grid-row').querySelector('.b-variations-container');
    const addBtn = container.querySelector('.add-bulk-var-btn');
    const tamInputs = container.querySelectorAll('.b-tam');

    if (catObj && catObj.tipoColuna === 'Tamanho') {
        tamInputs.forEach(i => { i.disabled = false; i.placeholder = "Tam"; i.type = "text"; });
        if(addBtn) addBtn.style.display = 'inline-block';
    } else {
        const varRows = container.querySelectorAll('.b-var-row');
        if(varRows.length > 1) for(let i=1; i<varRows.length; i++) varRows[i].remove();
        tamInputs[0].disabled = true; tamInputs[0].value = ""; tamInputs[0].placeholder = "-";
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
    const btn = document.getElementById('btn-save-bulk'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subindo fotos...'; btn.disabled = true;
    try {
        for(let r of document.querySelectorAll('#bulk-rows .grid-row')) {
            const nm = r.querySelector('.b-nome').value.trim(); if(!nm) continue;
            let url = ""; const f = r.querySelector('.b-file').files[0]; if(f) url = await upImg(f);
            for (let vr of r.querySelectorAll('.b-var-row')) {
                await addDoc(collection(db, "produtos"), { nome: nm, categoria: r.querySelector('.b-cat').value, min: parseInt(r.querySelector('.b-min').value)||1, descricaoItem: r.querySelector('.b-dmenu').value.trim(), descricaoPopup: r.querySelector('.b-dpop').value.trim(), imagemUrl: url, ativo: true, tamanho: vr.querySelector('.b-tam').value.trim(), preco: parseFloat(vr.querySelector('.b-preco').value)||0, descricaoResumo: vr.querySelector('.b-dres').value.trim() });
            }
        }
        customAlert("Lote adicionado!"); document.getElementById('bulk-rows').innerHTML = ''; window.closeModal('modal-bulk-prod'); loadProds();
    } catch(err) { customAlert("Erro.", "Erro"); } finally { btn.innerHTML = 'Salvar'; btn.disabled = false; }
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
    
    filtered.sort(sortProducts).forEach((p) => {
        const imgTag = p.imagemUrl ? `<img src="${p.imagemUrl}" class="img-preview">` : `<div class="img-preview" style="background:#eee; display:flex; align-items:center; justify-content:center;"><i class="fas fa-image" style="color:#ccc;"></i></div>`;
        const isNewGroup = p.nome !== chaveAtual; if(isNewGroup) chaveAtual = p.nome;

        tb.innerHTML += `<tr class="${isNewGroup ? 'group-separator-top' : ''}">
            <td data-label="Sel:" style="text-align: center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${p.id}" onchange="window.checkSelection('produtos')"></td>
            <td data-label="Foto:">${imgTag}</td><td data-label="Nome:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${p.nome}</strong></td>
            <td data-label="Categoria:">${p.categoria}</td><td data-label="Tam:">${p.tamanho||'-'}</td><td data-label="Mín:">${p.min||1}</td>
            <td data-label="Preço:">R$ ${p.preco.toFixed(2)}</td><td data-label="Desc. Produto:"><small>${p.descricaoItem ? window.formatText(p.descricaoItem) : '-'}</small></td>
            <td data-label="Desc. Resumo:"><small>${p.descricaoResumo ? window.formatText(p.descricaoResumo) : '-'}</small></td><td data-label="Desc. Imagem:"><small>${p.descricaoPopup ? window.formatText(p.descricaoPopup) : '-'}</small></td>
            <td data-label="Status:"><span class="badge ${p.ativo?'ativo':'inativo'}">${p.ativo?'Visível':'Oculto'}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditor('${p.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-action toggle" onclick="window.togP('${p.id}', ${!p.ativo})"><i class="fas fa-${p.ativo?'eye':'eye-slash'}"></i></button>
                    <button class="btn-action del" onclick="window.delP('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

window.openEditor = async(id) => {
    const p = (await getDoc(doc(db,"produtos",id))).data();
    document.getElementById('e-id').value = id; document.getElementById('e-nome').value = p.nome; document.getElementById('e-cat').value = p.categoria; document.getElementById('e-preco').value = p.preco; document.getElementById('e-min').value = p.min||1; document.getElementById('e-dmenu').value = p.descricaoItem||''; document.getElementById('e-dres').value = p.descricaoResumo||''; document.getElementById('e-dpop').value = p.descricaoPopup||''; 
    const catObj = globalCategories.find(c => c.nome === p.categoria);
    if (catObj && catObj.tipoColuna === 'Tamanho') { document.getElementById('e-tam-container').style.display = 'block'; document.getElementById('e-tam').value = p.tamanho||''; } else { document.getElementById('e-tam-container').style.display = 'none'; document.getElementById('e-tam').value = ''; }
    
    if (p.imagemUrl && p.imagemUrl.trim() !== '') {
        document.getElementById('e-img-preview').src = p.imagemUrl; document.getElementById('e-img-preview').style.display = 'block'; document.getElementById('btn-remove-e-img').style.display = 'inline-block'; document.getElementById('e-img-none').style.display = 'none';
    } else {
        document.getElementById('e-img-preview').style.display = 'none'; document.getElementById('btn-remove-e-img').style.display = 'none'; document.getElementById('e-img-none').style.display = 'block';
    }
    document.getElementById('e-remove-img').value = 'false'; window.openModal('modal-editar-prod');
};

document.getElementById('e-cat').addEventListener('change', function() {
    const catObj = globalCategories.find(c => c.nome === this.value);
    document.getElementById('e-tam-container').style.display = (catObj && catObj.tipoColuna === 'Tamanho') ? 'block' : 'none';
});

document.getElementById('form-edit-prod').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        const data = { nome: document.getElementById('e-nome').value, categoria: document.getElementById('e-cat').value, tamanho: document.getElementById('e-tam').value, preco: parseFloat(document.getElementById('e-preco').value)||0, min: parseInt(document.getElementById('e-min').value)||1, descricaoItem: document.getElementById('e-dmenu').value, descricaoResumo: document.getElementById('e-dres').value, descricaoPopup: document.getElementById('e-dpop').value };
        const f = document.getElementById('e-file').files[0]; if (f) data.imagemUrl = await upImg(f); else if (document.getElementById('e-remove-img').value === 'true') data.imagemUrl = ""; 
        await updateDoc(doc(db, "produtos", document.getElementById('e-id').value), data); customAlert("Produto Atualizado!"); window.closeModal('modal-editar-prod', 'form-edit-prod'); loadProds(); 
    } catch(err) { customAlert("Erro.", "Erro"); } finally { btn.innerHTML = 'Salvar Alterações'; btn.disabled = false; }
};

window.togP = async(id, s) => { await updateDoc(doc(db, "produtos", id), {ativo:s}); loadProds(); };
window.delP = async(id) => { customConfirm("Excluir item?", async () => { await deleteDoc(doc(db, "produtos", id)); loadProds(); }); };

document.getElementById('search-aviso').addEventListener('input', () => { window.renderAvisosTable(); });
document.getElementById('form-add-aviso').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;
    try {
        let url = ""; const f = document.getElementById('aa-file').files[0]; if(f) url = await upImg(f);
        await addDoc(collection(db, "avisos"), { titulo: document.getElementById('aa-tit').value, texto: document.getElementById('aa-txt').value, inicio: new Date(`${document.getElementById('aa-inid').value}T${document.getElementById('aa-inih').value}`).getTime(), fim: new Date(`${document.getElementById('aa-fimd').value}T${document.getElementById('aa-fimh').value}`).getTime(), imagemUrl: url, ativo: true });
        customAlert("Comunicado Agendado!"); window.closeModal('modal-add-aviso', 'form-add-aviso'); loadAvisos();
    } catch(err) { customAlert("Erro.", "Erro"); } finally { btn.innerHTML = 'Agendar Aviso'; btn.disabled = false; }
};

async function loadAvisos() {
    const s = await getDocs(collection(db, "avisos")); allAvisos = []; s.forEach(d => allAvisos.push({id: d.id, ...d.data()})); window.renderAvisosTable();
}

window.renderAvisosTable = function() {
    const tb = document.querySelector("#tbl-avisos tbody"); tb.innerHTML = "";
    const searchTerm = document.getElementById('search-aviso').value.toLowerCase();
    allAvisos.filter(a => `${a.titulo} ${a.texto}`.toLowerCase().includes(searchTerm)).forEach(a => {
        const isAtivo = a.ativo !== false; const agora = Date.now();
        let st = "", stClass = "";
        if(!isAtivo) { st = "Oculto"; stClass = "inativo"; } else { if(agora < a.inicio) { st = "Agendado"; stClass = "agendado"; } else if (agora <= a.fim) { st = "Andamento"; stClass = "ativo"; } else { st = "Concluso"; stClass = "concluso"; } }
        tb.innerHTML += `<tr><td style="text-align:center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${a.id}" onchange="window.checkSelection('avisos')"></td><td>${a.imagemUrl ? `<img src="${a.imagemUrl}" class="img-preview">` : ''}</td><td><strong>${a.titulo}</strong></td><td><small>${window.formatText(a.texto)}</small></td><td>${new Date(a.inicio).toLocaleString()}</td><td>${new Date(a.fim).toLocaleString()}</td><td><span class="badge ${stClass}">${st}</span></td><td><div class="action-btns-wrapper"><button class="btn-action edit" onclick="window.openEditAviso('${a.id}')"><i class="fas fa-pen"></i></button><button class="btn-action toggle" onclick="window.togA('${a.id}', ${!isAtivo})"><i class="fas fa-${isAtivo?'eye':'eye-slash'}"></i></button><button class="btn-action del" onclick="window.delDoc('avisos','${a.id}')"><i class="fas fa-trash"></i></button></div></td></tr>`;
    });
}

window.openEditAviso = async(id) => {
    const a = (await getDoc(doc(db,"avisos",id))).data();
    document.getElementById('ea-id').value = id; document.getElementById('ea-tit').value = a.titulo; document.getElementById('ea-txt').value = a.texto;
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const dIni = new Date(a.inicio - tzOffset); document.getElementById('ea-inid').value = dIni.toISOString().split('T')[0]; document.getElementById('ea-inih').value = dIni.toISOString().split('T')[1].slice(0,5);
    const dFim = new Date(a.fim - tzOffset); document.getElementById('ea-fimd').value = dFim.toISOString().split('T')[0]; document.getElementById('ea-fimh').value = dFim.toISOString().split('T')[1].slice(0,5);
    if (a.imagemUrl) { document.getElementById('ea-img-preview').src = a.imagemUrl; document.getElementById('ea-img-preview').style.display = 'block'; document.getElementById('btn-remove-ea-img').style.display = 'inline-block'; document.getElementById('ea-img-none').style.display = 'none'; } else { document.getElementById('ea-img-preview').style.display = 'none'; document.getElementById('btn-remove-ea-img').style.display = 'none'; document.getElementById('ea-img-none').style.display = 'block'; }
    document.getElementById('ea-remove-img').value = 'false'; window.openModal('modal-editar-aviso');
};

document.getElementById('form-edit-aviso').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        let data = { titulo: document.getElementById('ea-tit').value, texto: document.getElementById('ea-txt').value, inicio: new Date(`${document.getElementById('ea-inid').value}T${document.getElementById('ea-inih').value}`).getTime(), fim: new Date(`${document.getElementById('ea-fimd').value}T${document.getElementById('ea-fimh').value}`).getTime() };
        const f = document.getElementById('ea-file').files[0]; if (f) data.imagemUrl = await upImg(f); else if (document.getElementById('ea-remove-img').value === 'true') data.imagemUrl = "";
        await updateDoc(doc(db, "avisos", document.getElementById('ea-id').value), data); customAlert("Aviso atualizado!"); window.closeModal('modal-editar-aviso', 'form-edit-aviso'); loadAvisos();
    } catch(e) { console.error(e); } finally { btn.innerHTML = 'Salvar Alterações'; btn.disabled = false; }
};
window.togA = async(id, s) => { await updateDoc(doc(db, "avisos", id), {ativo: s}); loadAvisos(); };

let currentOrcCatFilter = '';
let orcQtdState = {};

window.getOrcQtd = function(id) { return orcQtdState[id] || 0; };
window.inputQtdOrcamento = function(input, itemId) { let val = parseInt(input.value); if(isNaN(val) || val < 0) val = 0; orcQtdState[itemId] = val; window.calcOrcamentoTotal(); };

window.renderOrcamentoMenu = function() {
    const container = document.getElementById('orc-menu-container'); const nav = document.getElementById('orc-cats-nav');
    container.innerHTML = ""; nav.innerHTML = "";
    const orcAgrupados = {}; allProducts.filter(p=>p.ativo).forEach(p => { const cat = p.categoria || 'Geral'; if(!orcAgrupados[cat]) orcAgrupados[cat] = []; orcAgrupados[cat].push(p); });
    
    const categoriasOrdenadas = Object.keys(orcAgrupados).sort(window.sortAlfabetico);
    
    if(categoriasOrdenadas.length > 0 && (!currentOrcCatFilter || !categoriasOrdenadas.includes(currentOrcCatFilter))) currentOrcCatFilter = categoriasOrdenadas[0];
    categoriasOrdenadas.forEach(c => nav.innerHTML += `<a class="categoria-btn-orc ${currentOrcCatFilter === c ? 'active-link' : ''}" onclick="window.filterOrc('${c}')">${c}</a>`);

    categoriasOrdenadas.filter(c=>c===currentOrcCatFilter).forEach(nomeCat => {
        const catObj = globalCategories.find(c => c.nome === nomeCat) || { tipoColuna: 'Tamanho' };
        const itens = orcAgrupados[nomeCat].sort(sortProducts);
        let thSecundaria = (catObj.tipoColuna && catObj.tipoColuna !== 'Nenhuma') ? `<th class="col-sec"><span class="th-mobile">${catObj.tipoColuna==='Mínimo'?'MÍN.':'TAM.'}</span><span class="th-desktop">${catObj.tipoColuna==='Mínimo'?'Mínimo':'Tamanho'}</span></th>` : '';
        let htmlTabela = `<div class="categoria-group-orc active-group"><h2 class="categoria-title-orc">${nomeCat}</h2><div class="table-card-orc"><table class="orc-table"><thead><tr><th class="col-item">ITEM</th><th class="col-icon"></th>${thSecundaria}<th class="col-unid"><span class="th-mobile">UNID.</span><span class="th-desktop">Unidade</span></th><th class="col-qtd"><span class="th-mobile">QTD</span><span class="th-desktop">Quantidade</span></th></tr></thead><tbody>`;

        let chaveAtual = null; const agruparPorNome = (catObj.tipoColuna === 'Tamanho'); const contagemNomes = {};
        if(agruparPorNome) itens.forEach(i => contagemNomes[i.nome.trim()] = (contagemNomes[i.nome.trim()] || 0) + 1);

        itens.forEach(p => {
            const inputHtml = `<div class="quantidade-input-group"><button type="button" class="qtd-btn-table" onclick="window.alterarQtdOrcamento('${p.id}', -1)">-</button><input type="number" value="${window.getOrcQtd(p.id)}" oninput="window.inputQtdOrcamento(this, '${p.id}')" class="quantidade-input orc-qtd-input" data-item-id="${p.id}"><button type="button" class="qtd-btn-table" onclick="window.alterarQtdOrcamento('${p.id}', 1)">+</button></div>`;
            const iconeHint = p.imagemUrl ? `<i class="fas fa-camera foto-hint"></i>` : (p.descricaoPopup ? `<i class="fas fa-info-circle foto-hint"></i>` : '');
            
            const celulaNomeHTML = `<div class="item-nome-texto" style="line-height: 1.2;">${window.formatText(p.nome.trim())}</div>${p.descricaoItem ? `<div class="descricao-orc">${window.formatText(p.descricaoItem)}</div>` : ''}`;
            let tdSec = (catObj.tipoColuna && catObj.tipoColuna !== 'Nenhuma') ? `<td class="col-sec">${catObj.tipoColuna === 'Mínimo' ? (p.min||1) : (p.tamanho||'-')}</td>` : '';
            const celulasRestantes = `${tdSec}<td class="col-unid">R$ ${p.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td><td class="col-qtd"><div class="quantidade-container">${inputHtml}</div></td>`;
            
            if(agruparPorNome) {
                if(p.nome.trim() !== chaveAtual) { chaveAtual = p.nome.trim(); htmlTabela += `<tr class="group-separator-top"><td rowspan="${contagemNomes[chaveAtual]}" class="col-item">${celulaNomeHTML}</td><td rowspan="${contagemNomes[chaveAtual]}" class="col-icon">${iconeHint}</td>${celulasRestantes}</tr>`; } 
                else htmlTabela += `<tr><td style="display:none;"></td><td style="display:none;"></td>${celulasRestantes}</tr>`;
            } else { htmlTabela += `<tr class="group-separator-top"><td class="col-item">${celulaNomeHTML}</td><td class="col-icon">${iconeHint}</td>${celulasRestantes}</tr>`; }
        });
        htmlTabela += `</tbody></table></div></div>`; container.innerHTML += htmlTabela;
    });
    window.calcOrcamentoTotal(); configurarEventosDragOrcamento();
};

window.filterOrc = function(cat) { currentOrcCatFilter = cat; window.renderOrcamentoMenu(); };
window.alterarQtdOrcamento = function(itemId, delta) { let val = (orcQtdState[itemId] || 0) + delta; if(val < 0) val = 0; orcQtdState[itemId] = val; const input = document.querySelector(`.orc-qtd-input[data-item-id="${itemId}"]`); if(input) input.value = val; window.calcOrcamentoTotal(); };
window.removerItemOrcamento = function(itemId) { orcQtdState[itemId] = 0; window.renderOrcamentoMenu(); window.calcOrcamentoTotal(); };

window.calcOrcamentoTotal = function() {
    let bruto = 0, totalItens = 0; const resumoItensPopup = document.getElementById("popup-resumo-itens-orc"); if(resumoItensPopup) resumoItensPopup.innerHTML = '';
    const gruposResumo = {};
    allProducts.forEach(p => {
        const q = orcQtdState[p.id] || 0;
        if(q > 0) { bruto += (q * p.preco); totalItens += q; const cat = p.categoria || 'Geral'; if(!gruposResumo[cat]) gruposResumo[cat] = []; gruposResumo[cat].push({ q, p: p.preco, desc: p.descricaoResumo || p.nome, id: p.id }); }
    });

    const desc = parseFloat(document.getElementById('orc-desconto').value) || 0; let liq = Math.max(0, bruto - desc);
    if(document.getElementById('orc-bruto-txt')) document.getElementById('orc-bruto-txt').textContent = bruto.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    if(document.getElementById('orc-liquido-txt')) document.getElementById('orc-liquido-txt').textContent = liq.toLocaleString('pt-BR', {minimumFractionDigits: 2});

    const btnSummary = document.getElementById('fixed-summary-orc');
    if(bruto > 0) {
        if(btnSummary) { btnSummary.style.display = 'block'; document.getElementById('summary-total-orc').textContent = `R$ ${liq.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`; document.getElementById('summary-item-count-orc').textContent = `/ ${totalItens} itens`; }
        if(resumoItensPopup) {
            for(const grupo in gruposResumo) {
                resumoItensPopup.innerHTML += `<div class="resumo-grupo-titulo">${grupo}:</div>`;
                gruposResumo[grupo].forEach(item => {
                    const descricaoItemPopupFormatada = window.formatText(item.desc);
                    resumoItensPopup.innerHTML += `<div class="resumo-item-line"><div class="resumo-item-name">${descricaoItemPopupFormatada} <small>R$ ${(item.q * item.p).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</small></div><div class="resumo-item-input-group"><button type="button" class="resumo-qtd-btn" onclick="window.alterarQtdOrcamento('${item.id}', -1)">-</button><input type="number" value="${item.q}" oninput="window.inputQtdOrcamento(this, '${item.id}')"><button type="button" class="resumo-qtd-btn" onclick="window.alterarQtdOrcamento('${item.id}', 1)">+</button></div><button type="button" class="btn-excluir" onclick="window.removerItemOrcamento('${item.id}')"><i class="fas fa-trash"></i></button></div>`;
                });
            }
        }
    } else {
        if(btnSummary) btnSummary.style.display = 'none';
        const modal = document.getElementById('modal-orcamento-pedido'); if(modal) { modal.classList.remove('show'); setTimeout(() => { modal.style.display = 'none'; }, 300); }
    }
};

window.abrirModalOrcamento = function() { window.openModal('modal-orcamento-pedido'); };
window.avancarDadosCliente = function() { document.getElementById('modal-orcamento-pedido').classList.remove('show'); setTimeout(() => { document.getElementById('modal-orcamento-pedido').style.display = 'none'; window.openModal('modal-orcamento-cliente'); }, 300); };
window.voltarResumoOrcamento = function() { document.getElementById('modal-orcamento-cliente').classList.remove('show'); setTimeout(() => { document.getElementById('modal-orcamento-cliente').style.display = 'none'; window.openModal('modal-orcamento-pedido'); }, 300); };
window.buscarContato = async function() {
    if (!('contacts' in navigator && 'ContactsManager' in window)) return customAlert("Navegador não suporta busca automática.");
    try { const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false }); if (contacts.length > 0) { if (contacts[0].name) document.getElementById('orc-nome').value = contacts[0].name[0]; if (contacts[0].tel) document.getElementById('orc-tel').value = contacts[0].tel[0].replace(/\D/g, ''); } } catch (err) { customAlert("Erro.", "Erro"); }
};

window.gerarOrcamentoWA = async function() {
    let temItens = false; const groups = {}; let bruto = 0;
    allProducts.forEach(p => { const q = orcQtdState[p.id] || 0; if(q > 0) { temItens = true; const cat = p.categoria || 'Geral'; bruto += (q * p.preco); if(!groups[cat]) groups[cat] = []; groups[cat].push({ q, p: p.preco, desc: p.descricaoResumo || p.nome }); } });
    if(!temItens) return customAlert("Adicione itens ao orçamento.");
    
    const nm = document.getElementById('orc-nome').value.trim().toUpperCase(), tel = document.getElementById('orc-tel').value.trim(), dt = document.getElementById('orc-data').value, hr = document.getElementById('orc-hora').value, pag = document.getElementById('orc-pag').value, obs = document.getElementById('orc-obs').value.trim();
    if(!nm || !dt || !hr || !pag || !tel) return customAlert("Preencha todos os dados.");

    let txt = `Segue o orçamento do seu pedido!\n\n*_- Resumo do pedido_:*\n\n`, resumoTextoFirestore = '';
    for(const cat in groups) {
        txt += `*${cat}:*\n`; resumoTextoFirestore += `- ${cat}:\n`;
        groups[cat].forEach(i => { 
            const tot = i.p * i.q; 
            txt += `${i.desc} - ${i.q} un. (R$ ${i.p.toFixed(2).replace('.',',')} cada) = R$ ${tot.toFixed(2).replace('.',',')}\n`; 
            resumoTextoFirestore += `${i.q} un. - ${i.desc} (R$ ${i.p.toFixed(2).replace('.',',')}) = R$ ${tot.toFixed(2).replace('.',',')}\n`; 
        });
        txt += `\n`;
    }
    const desc = parseFloat(document.getElementById('orc-desconto').value) || 0; const liq = Math.max(0, bruto - desc);
    txt += `*- Valor dos Itens (Bruto)*: R$ ${bruto.toFixed(2).replace('.',',')}\n`;
    if(desc > 0) txt += `*- Desconto Aplicado*: R$ ${desc.toFixed(2).replace('.',',')}\n`;
    const dateFormatted = `${dt.split('-')[2]}/${dt.split('-')[1]}/${dt.split('-')[0]}`;
    txt += `\n* - Valor final do Pedido_*: *R$ ${liq.toFixed(2).replace('.',',')}*\n\n\n*- - - - - - - - - - - - - - - - - - - - - - - - - - - - - -*\n\n_*- Informações do pedido:*_\n\n*Nome*: ${nm}\n*Data*: ${dateFormatted}\n*Horário*: ${hr}\n*Forma de Pagamento*: ${pag}`;

    const orderId = 'PD' + Date.now().toString().slice(-7);
    try { await setDoc(doc(db, "pedidos", orderId), { ID_do_Pedido: orderId, origem: 'orcamento', Status_do_Pedido: 'Pedidos Orçados', Nome_Cliente: nm, Numero: tel, Data_Entrega: dateFormatted, Horario_Entrega: hr, Total_Final: liq.toFixed(2).replace('.', ','), Forma_de_Pagamento: pag, Status_Pagamento: 'Pagamento pendente', Cupom: desc > 0 ? `Desconto Manual R$ ${desc.toFixed(2).replace('.', ',')}` : '', Observacoes: obs, Resumo_dos_Itens: resumoTextoFirestore.trim(), createdAt: Date.now() }); window.showToast("Orçamento salvo como Pedido!"); } catch (e) {}

    let cleanTel = tel.replace(/\D/g, ''); if(cleanTel.length >= 10 && !cleanTel.startsWith('55')) cleanTel = '55' + cleanTel;
    window.open(`https://wa.me/${cleanTel}?text=${encodeURIComponent(txt)}`, '_blank');
    
    orcQtdState = {}; document.getElementById('form-pedido-orc').reset(); document.getElementById('orc-desconto').value = '0';
    window.renderOrcamentoMenu(); document.getElementById('modal-orcamento-cliente').classList.remove('show'); setTimeout(() => { document.getElementById('modal-orcamento-cliente').style.display = 'none'; }, 300);
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
        board.innerHTML += `<div class="kanban-column" data-status="${status}"><div class="column-header"><div style="display:flex; align-items:center; gap:10px;"><input type="checkbox" class="column-select-all-checkbox" onclick="window.toggleSelectColumn(this, '${status}')"><span>${status} (<span class="count-badge">0</span>)</span></div></div><div class="column-content" id="col-${limparString(status)}" ondrop="window.drop(event)" ondragover="window.allowDrop(event)"></div></div>`;
        if(bulkSelect) bulkSelect.innerHTML += `<option value="${status}">${status}</option>`;
    });
};

function limparString(str) { return str.replace(/[^a-zA-Z0-9]/g, ''); }
function parseDataBR(s) { if (!s || typeof s !== 'string') return null; const p = s.trim().split('/'); if (p.length !== 3) return null; const d = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, a = parseInt(p[2], 10); if (isNaN(d) || isNaN(m) || isNaN(a)) return null; return new Date(a, m, d, 0, 0, 0, 0); }
function parseDataISO(s) { if (!s || typeof s !== 'string') return null; const p = s.trim().split('-'); if (p.length !== 3) return null; const a = parseInt(p[0], 10), m = parseInt(p[1], 10) - 1, d = parseInt(p[2], 10); if (isNaN(d) || isNaN(m) || isNaN(a)) return null; return new Date(a, m, d, 0, 0, 0, 0); }
function parseHorario(s) { if (!s || typeof s !== 'string') return 0; const p = s.trim().split(':'); if (p.length !== 2) return 0; const h = parseInt(p[0], 10), m = parseInt(p[1], 10); if (isNaN(h) || isNaN(m)) return 0; return h * 60 + m; }
function ordenarPedidosPorDataHorario(pedidos) { return pedidos.sort((a, b) => { const dA = parseDataBR(a.Data_Entrega), dB = parseDataBR(b.Data_Entrega); if (!dA && !dB) return 0; if (!dA) return 1; if (!dB) return -1; const diff = dA.getTime() - dB.getTime(); if (diff !== 0) return diff; return parseHorario(a.Horario_Entrega) - parseHorario(b.Horario_Entrega); }); }
function converterValorParaNumero(v) { if (!v) return 0; let s = String(v).replace(/R\$/gi, '').trim(); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/\D/g, ''); const n = parseFloat(s); return isNaN(n) ? 0 : n; }
function formatarValorComCentavos(v) { return converterValorParaNumero(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function calcularValorPedido(p) { if (!p || !p.Total_Final) return 0; let v = String(p.Total_Final).trim(); if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.'); v = v.replace(/[^\d.]/g, ''); return parseFloat(v) || 0; }

function listenPedidos() {
    onSnapshot(collection(db, "pedidos"), (snap) => {
        window.todosPedidos = []; snap.forEach(doc => { let d = doc.data(); if (!d.ID_do_Pedido) d.ID_do_Pedido = doc.id; window.todosPedidos.push(d); });
        window.filtrarPedidos();
    });
}

window.obterPedidosDoMesAtual = function() { const hj = new Date(), mA = hj.getMonth(), aA = hj.getFullYear(); return window.todosPedidos.filter(p => { const d = parseDataBR(p.Data_Entrega); return d && d.getMonth() === mA && d.getFullYear() === aA; }); }
window.obterPedidosFiltrados = function() {
    const s = document.getElementById('search-input-pedidos') ? document.getElementById('search-input-pedidos').value.trim().toLowerCase() : '';
    const df = document.getElementById('date-input') ? document.getElementById('date-input').value : ''; 
    const sp = document.getElementById('filter-status-pagamento') ? document.getElementById('filter-status-pagamento').value : '';
    const fp = document.getElementById('filter-forma-pagamento') ? document.getElementById('filter-forma-pagamento').value : '';
    const ob = document.getElementById('filter-observacao') ? document.getElementById('filter-observacao').value : '';

    return window.todosPedidos.filter(p => {
        if (s && !((p.Nome_Cliente || '').toLowerCase().includes(s) || (p.ID_do_Pedido || '').toLowerCase().includes(s) || (p.Numero || '').includes(s))) return false;
        if (df) { const dp = parseDataBR(p.Data_Entrega); if (!dp) return false; if (df.includes(',')) { const [di, dF] = df.split(','); const dtI = parseDataISO(di.trim()), dtF = parseDataISO(dF.trim()); if (!dtI || !dtF || !(dp.getTime() >= dtI.getTime() && dp.getTime() <= dtF.getTime())) return false; } else { const dt = parseDataISO(df.trim()); if (!dt || dp.getTime() !== dt.getTime()) return false; } }
        if (sp && (p.Status_Pagamento || 'Pagamento pendente').trim() !== sp) return false;
        if (fp && (p.Forma_de_Pagamento || '').trim() !== fp) return false;
        if (ob) { const tO = p.Observacoes && p.Observacoes.trim() !== ''; if (ob === 'com' && !tO) return false; if (ob === 'sem' && tO) return false; }
        return true;
    });
}

window.filtrarPedidos = function() {
    const txt = document.getElementById('search-input-pedidos') ? document.getElementById('search-input-pedidos').value.trim() : '';
    const dt = document.getElementById('date-input') ? document.getElementById('date-input').value : '';
    let escopo = (txt || dt) ? window.obterPedidosFiltrados() : window.obterPedidosFiltrados().filter(p => window.obterPedidosDoMesAtual().includes(p));
    window.renderizar(escopo);
}

window.renderizar = function(pedidos) {
    document.querySelectorAll('.column-content').forEach(el => el.innerHTML = '');
    const contadores = {}; window.STATUS_FLOW.forEach(s => contadores[s] = 0);
    const pedStatus = {}; window.STATUS_FLOW.forEach(s => pedStatus[s] = []);

    pedidos.forEach(p => { const s = window.STATUS_FLOW.find(x => x.toLowerCase() === (p.Status_do_Pedido || 'Pedidos Orçados').toLowerCase()) || 'Pedidos Orçados'; pedStatus[s].push(p); });

    window.STATUS_FLOW.forEach(s => {
        const ord = ordenarPedidosPorDataHorario([...pedStatus[s]]);
        const col = document.getElementById(`col-${limparString(s)}`);
        if (col) ord.forEach(p => { col.appendChild(window.criarCardHTML(p)); contadores[s]++; });
    });

    window.STATUS_FLOW.forEach(s => { const c = document.querySelector(`.kanban-column[data-status="${s}"]`); if(c) c.querySelector('.count-badge').textContent = contadores[s]; });
    if (window.innerWidth <= 768) document.querySelectorAll('.kanban-column').forEach(c => c.classList.remove('expanded'));
    window.configurarAcordeaoColunas(); window.atualizarDashboardPedidos();
}

window.atualizarDashboardPedidos = function() {
    let pedCalc = window.ticketsSelecionados.size > 0 ? window.todosPedidos.filter(p => window.ticketsSelecionados.has(p.ID_do_Pedido)) : ( (document.getElementById('search-input-pedidos')?.value.trim() || document.getElementById('date-input')?.value) ? window.obterPedidosFiltrados() : window.obterPedidosFiltrados().filter(p => window.obterPedidosDoMesAtual().includes(p)) );
    let tv = 0, tp = 0; 
    pedCalc.forEach(p => { 
        if (!(p.Status_do_Pedido || '').toLowerCase().includes('cancelado')) {
            tp++; 
            tv += calcularValorPedido(p); 
        }
    });
    if(document.querySelector('#dashboard-totals strong')) document.querySelector('#dashboard-totals strong').textContent = tv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if(document.getElementById('total-count')) document.getElementById('total-count').textContent = `${tp} pedido${tp !== 1 ? 's' : ''}`;
}

window.criarCardHTML = function(p) {
    const c = document.createElement('div'); const st = (p.Status_do_Pedido || '').replace(/\s+/g, '-'); const tO = p.Observacoes && p.Observacoes.trim() !== '';
    c.className = `pedido-card status-${st} ${tO ? 'com-observacao' : ''} ${window.ticketsSelecionados.has(p.ID_do_Pedido) ? 'selected' : ''}`;
    if(window.isDragEnabled) c.draggable = true; c.id = `card-${p.ID_do_Pedido}`; c.dataset.id = p.ID_do_Pedido;
    if(window.isDragEnabled) c.addEventListener('dragstart', window.drag);
    c.addEventListener('click', (e) => { if(e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') window.abrirModalEdicao(p.ID_do_Pedido); });

    const pg = (p.Status_Pagamento || 'Pagamento pendente').toLowerCase(); let pC = pg.includes('50%') ? 'pg-parcial' : (pg.includes('100%') || pg === 'pago' ? 'pg-pago' : 'pg-pendente');
    const fP = (p.Forma_de_Pagamento || '').trim().toLowerCase(); let tt = '', tc = '';
    if (fP.includes('pix')) { tt = 'PIX'; tc = 'pix'; } else if (fP.includes('dinheiro')) { tt = 'DINHEIRO'; tc = 'dinheiro'; } else if (fP.includes('cartão') || fP.includes('cartao')) { tt = 'CARTÃO'; tc = 'cartao'; } else if (fP) { tt = fP.toUpperCase(); tc = fP.replace(/[^a-z0-9]/g, ''); }

    c.innerHTML = `<div class="card-header"><input type="checkbox" class="card-checkbox" ${window.ticketsSelecionados.has(p.ID_do_Pedido) ? 'checked' : ''} onclick="window.toggleSelecao('${p.ID_do_Pedido}', this); event.stopPropagation();"><div style="text-align: right;"><div><span class="card-id">${p.ID_do_Pedido}</span></div>${tO ? '<div><span class="observacao-tag">OBSERVAÇÃO</span></div>' : ''}</div></div><br><div class="card-title">${p.Nome_Cliente}</div><div class="card-info-box"><div class="card-info-row"><span class="card-icon">🗓️</span> ${p.Data_Entrega || '--/--/----'}</div><div class="card-info-row"><span class="card-icon">⏰</span> ${p.Horario_Entrega || '--:--'}</div><div class="card-info-row"><span class="card-icon">📱</span> <button class="card-numero-btn" onclick="window.abrirModalWhatsApp('${p.ID_do_Pedido}'); event.stopPropagation();">${p.Numero || 'N/A'}</button></div></div>${p.Cupom ? `<div class="card-cupom"><span class="card-cupom-label">Cupom/Desc:</span> ${p.Cupom}</div>` : ''}<div class="card-price"><span>R$ ${formatarValorComCentavos(p.Total_Final)}</span>${tt ? `<span class="payment-type-tag ${tc}">${tt}</span>` : ''}</div><div class="card-status-pagamento"><select class="${pC}" onchange="window.atualizarStatusPagamentoDireto('${p.ID_do_Pedido}', this)"><option value="Pagamento pendente" ${pg === 'pendente' || pg === 'pagamento pendente' ? 'selected' : ''}>Pagamento pendente</option><option value="Pago 50%" ${pg.includes('50') ? 'selected' : ''}>Pago 50%</option><option value="Pago 100%" ${pg.includes('100') || pg === 'pago' ? 'selected' : ''}>Pago 100%</option></select></div>`;
    return c;
}

window.configurarAcordeaoColunas = function() {
    document.querySelectorAll('.column-header').forEach(h => { const nH = h.cloneNode(true); h.parentNode.replaceChild(nH, h); });
    if (window.innerWidth <= 768) { document.querySelectorAll('.column-header').forEach(h => { h.addEventListener('click', (e) => { if (e.target.type === 'checkbox' || e.target.closest('.column-select-all-checkbox')) return; const c = h.closest('.kanban-column'); if (!c) return; document.querySelectorAll('.kanban-column').forEach(col => { if (col !== c) col.classList.remove('expanded'); }); c.classList.toggle('expanded'); }); }); }
}

window.allowDrop = function(e) { e.preventDefault(); }; window.drag = function(e) { e.dataTransfer.setData("text", e.target.dataset.id); };
window.drop = async function(e) { e.preventDefault(); const id = e.dataTransfer.getData("text"); const c = e.target.closest('.kanban-column'); if(!c) return; const nS = c.dataset.status; const card = document.getElementById(`card-${id}`); if(card) c.querySelector('.column-content').appendChild(card); window.mostrarLoading(true); try { await updateDoc(doc(db, "pedidos", id), { Status_do_Pedido: nS }); window.showToast("Status atualizado!"); } catch(err) { window.showToast("Erro ao mover", true); } window.mostrarLoading(false); }
window.toggleSelecao = function(id, cb) { if(cb.checked) window.ticketsSelecionados.add(id); else window.ticketsSelecionados.delete(id); window.atualizarBarraAcoesPedidos(); }
window.toggleSelectColumn = function(cb, s) { document.querySelector(`.kanban-column[data-status="${s}"]`).querySelectorAll('.card-checkbox').forEach(c => { c.checked = cb.checked; window.toggleSelecao(c.closest('.pedido-card').dataset.id, c); }); }
window.atualizarBarraAcoesPedidos = function() { const bar = document.getElementById('bulk-actions-bar-pedidos'); if(document.getElementById('selected-count-pedidos')) document.getElementById('selected-count-pedidos').textContent = `${window.ticketsSelecionados.size} itens`; if(bar) bar.style.display = window.ticketsSelecionados.size > 0 ? 'flex' : 'none'; window.atualizarDashboardPedidos(); }
window.limparSelecaoPedidos = function() { window.ticketsSelecionados.clear(); document.querySelectorAll('.card-checkbox, .column-select-all-checkbox').forEach(cb => cb.checked = false); window.atualizarBarraAcoesPedidos(); }

window.abrirBulkMove = function() { document.getElementById('bulk-move-modal').style.display = 'flex'; }
window.executarBulkMove = async function() { const nS = document.getElementById('bulk-move-select').value; window.mostrarLoading(true); await Promise.all(Array.from(window.ticketsSelecionados).map(id => updateDoc(doc(db, "pedidos", id), { Status_do_Pedido: nS }))); window.mostrarLoading(false); document.getElementById('bulk-move-modal').style.display = 'none'; window.limparSelecaoPedidos(); window.showToast("Pedidos movidos!"); }
window.abrirBulkPayment = function() { document.getElementById('bulk-payment-modal').style.display = 'flex'; }
window.executarBulkPayment = async function() { const nS = document.getElementById('bulk-payment-select').value; window.mostrarLoading(true); await Promise.all(Array.from(window.ticketsSelecionados).map(id => updateDoc(doc(db, "pedidos", id), { Status_Pagamento: nS }))); window.mostrarLoading(false); document.getElementById('bulk-payment-modal').style.display = 'none'; window.limparSelecaoPedidos(); window.showToast("Pagamentos atualizados!"); }
window.atualizarStatusPagamentoDireto = async function(id, sel) { window.mostrarLoading(true); try { await updateDoc(doc(db, "pedidos", id), { Status_Pagamento: sel.value }); window.showToast("Pagamento Atualizado!"); } catch (err) { window.showToast("Erro ao salvar", true); } window.mostrarLoading(false); }

window.abrirModalEdicao = function(id) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === id); if(!p) return;
    document.getElementById('modal-id-display').textContent = `#${id}`; document.getElementById('edit-id-pedido').value = id; document.getElementById('edit-nome-pedido').value = p.Nome_Cliente || ''; document.getElementById('edit-telefone-pedido').value = p.Numero || ''; 
    const dp = (p.Data_Entrega || '').split('/'); document.getElementById('edit-data-pedido').value = dp.length === 3 ? `${dp[2]}-${dp[1]}-${dp[0]}` : '';
    document.getElementById('edit-hora-pedido').value = p.Horario_Entrega || ''; document.getElementById('edit-forma-pedido').value = p.Forma_de_Pagamento || 'Pix'; document.getElementById('edit-status-pgto-pedido').value = p.Status_Pagamento || 'Pagamento pendente'; document.getElementById('edit-cupom-pedido').value = p.Cupom || ''; document.getElementById('edit-total-pedido').value = p.Total_Final || ''; document.getElementById('edit-obs-pedido').value = p.Observacoes || ''; document.getElementById('edit-resumo-pedido').value = p.Resumo_dos_Itens || '';
    window.preencherSelectProdutosAdicionais(); window.openModal('edit-modal-pedido');
}

window.preencherSelectProdutosAdicionais = function() {
    const sel = document.getElementById('add-produto-select'); sel.innerHTML = '<option value="">Selecione um produto...</option><option value="__OUTROS__">--- Outros ---</option>';
    allProducts.sort(sortProducts).forEach(p => { const o = document.createElement('option'); const n = p.tamanho ? `${p.nome} - ${p.tamanho}` : p.nome; o.value = p.id; o.textContent = n; o.dataset.preco = p.preco; o.dataset.cat = p.categoria; o.dataset.nomeExibicao = n; sel.appendChild(o); });
}

window.toggleCamposOutros = function() {
    const s = document.getElementById('add-produto-select'), c = document.getElementById('add-nome-outros-container'), p = document.getElementById('add-preco');
    if (s.value === '__OUTROS__') { c.style.display = 'block'; p.value = ''; } else { c.style.display = 'none'; if (s.value) { const o = s.options[s.selectedIndex], val = parseFloat(o.dataset.preco); if(!isNaN(val)) p.value = val.toFixed(2).replace('.', ','); } else { p.value = ''; } }
}

window.adicionarItemAoResumoPedido = function() {
    const s = document.getElementById('add-produto-select'), qI = document.getElementById('add-qtd'), pI = document.getElementById('add-preco'), r = document.getElementById('edit-resumo-pedido'), tI = document.getElementById('edit-total-pedido');
    if(!s.value) return window.showToast('Selecione um produto', true);
    let n, c, p; const q = parseInt(qI.value) || 1;
    if(s.value === '__OUTROS__') { n = document.getElementById('add-nome-outros').value.trim(); c = 'Outros'; if(!n) return window.showToast('Informe o nome', true); } else { const o = s.options[s.selectedIndex]; n = o.dataset.nomeExibicao; c = o.dataset.cat || 'Geral'; }
    p = parseFloat(pI.value.replace(',','.')) || 0; const t = p * q; const lI = `${q} un. - ${n} (R$ ${p.toFixed(2).replace('.',',')}) = R$ ${t.toFixed(2).replace('.',',')}`;
    let ls = r.value ? r.value.split('\n') : [], cI = -1, nI = ls.length;
    for (let i = 0; i < ls.length; i++) { const l = ls[i].trim(); if ((l.startsWith('-') || l.endsWith(':')) && l.toLowerCase().includes(c.toLowerCase())) { cI = i; for (let j = i + 1; j < ls.length; j++) { if (ls[j].trim().startsWith('-') || ls[j].trim().endsWith(':')) { nI = j; break; } } break; } }
    if (cI >= 0) ls.splice(nI, 0, lI); else { if (ls.length > 0 && ls[ls.length - 1].trim() !== '') ls.push(''); ls.push(`- ${c}:`); ls.push(lI); }
    r.value = ls.join('\n');
    tI.value = ((tI.value ? parseFloat(tI.value.replace(/[^\d,]/g, '').replace(',', '.')) : 0) + t).toFixed(2).replace('.', ',');
    s.value = ''; qI.value = '1'; pI.value = ''; document.getElementById('add-nome-outros').value = ''; window.toggleCamposOutros(); window.showToast('Item adicionado!');
}

window.submitEditForm = async function(e) {
    e.preventDefault(); window.mostrarLoading(true);
    const id = document.getElementById('edit-id-pedido').value, dt = document.getElementById('edit-data-pedido').value;
    try {
        await updateDoc(doc(db, "pedidos", id), { Nome_Cliente: document.getElementById('edit-nome-pedido').value, Numero: document.getElementById('edit-telefone-pedido').value, Data_Entrega: dt ? `${dt.split('-')[2]}/${dt.split('-')[1]}/${dt.split('-')[0]}` : "", Horario_Entrega: document.getElementById('edit-hora-pedido').value, Total_Final: document.getElementById('edit-total-pedido').value.replace('.', ','), Forma_de_Pagamento: document.getElementById('edit-forma-pedido').value, Status_Pagamento: document.getElementById('edit-status-pgto-pedido').value, Cupom: document.getElementById('edit-cupom-pedido').value, Observacoes: document.getElementById('edit-obs-pedido').value, Resumo_dos_Itens: document.getElementById('edit-resumo-pedido').value, updatedAt: Date.now() });
        window.showToast("Salvo!"); window.fecharModalPedido('edit-modal-pedido');
    } catch (err) { window.showToast("Erro ao salvar!", true); } window.mostrarLoading(false);
}

window.abrirModalResumos = function() { if(window.todosPedidos.filter(p => window.ticketsSelecionados.has(p.ID_do_Pedido)).length === 0) return window.showToast("Selecione pelo menos um pedido!", true); document.getElementById('resumos-modal').style.display = 'flex'; }
window.gerarListaPedidos = function() {
    const sel = window.todosPedidos.filter(p => window.ticketsSelecionados.has(p.ID_do_Pedido)); if(sel.length === 0) return;
    let t = `Resumo ${sel.length} Pedido(s):\n\n`;
    sel.forEach((p, i) => { t += `Pedido ${i + 1}\n\n* ${p.Nome_Cliente}\n   ⤷ ${p.Data_Entrega || '--/--/----'} às ${p.Horario_Entrega || '--:--'}\n   ⤷ ${p.ID_do_Pedido}\n\n*- Itens:*\n\n${p.Resumo_dos_Itens ? p.Resumo_dos_Itens : 'Sem itens descritos'}\n\n*Total:* R$ ${formatarValorComCentavos(p.Total_Final)}\n\n------------------------------------------\n\n`; });
    window.open(`https://wa.me/?text=${encodeURIComponent(t)}`, '_blank'); document.getElementById('resumos-modal').style.display = 'none';
}
window.gerarResumoItens = function() { window.gerarListaPedidos(); }

window.abrirModalWhatsApp = function(id) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === id); if (!p) return; window.pedidoWhatsAppAtual = id;
    const n = (p.Nome_Cliente || 'Cliente').trim().split(' ')[0];
    document.getElementById('whatsapp-confirm-title').textContent = `Contato com ${n}`;
    document.getElementById('whatsapp-confirm-message').innerHTML = `<div style="display: flex; flex-direction: column; gap: 10px; margin: 20px 0;"><button class="btn btn-primary" onclick="window.confirmarEnvioWhatsApp('resumo')" style="width: 100%; justify-content:center;">📋 Enviar resumo</button><button class="btn btn-secondary" onclick="window.confirmarEnvioWhatsApp('contato')" style="width: 100%; justify-content:center;">💬 Entrar em contato</button><button class="btn btn-outline" onclick="window.confirmarEnvioWhatsApp('pronto')" style="width: 100%; border-color:#28a745; color:#28a745; justify-content:center;">✅ Pedido Pronto</button></div>`;
    document.getElementById('whatsapp-confirm-modal').style.display = 'flex';
}

window.confirmarEnvioWhatsApp = async function(m) {
    const p = window.todosPedidos.find(x => x.ID_do_Pedido === window.pedidoWhatsAppAtual); if (!p) return;
    let num = p.Numero ? p.Numero.replace(/\D/g, '') : ''; if(num.length >= 10 && !num.startsWith('55')) num = '55' + num;
    const n = (p.Nome_Cliente || 'Cliente').trim().split(' ')[0]; let t = '';
    if (m === 'resumo') { t = `*Olá ${n}!*\n\n*Resumo do Pedido ${p.ID_do_Pedido}*\n\n*Data de Entrega:* ${p.Data_Entrega || '--/--/----'}\n*Horário:* ${p.Horario_Entrega || '--:--'}\n\n${p.Resumo_dos_Itens ? `*Itens:*\n${p.Resumo_dos_Itens}\n\n` : ''}*Total:* R$ ${formatarValorComCentavos(p.Total_Final)}\n*Forma de Pagamento:* ${p.Forma_de_Pagamento || 'Não informado'}`; } 
    else if (m === 'pronto') { window.mostrarLoading(true); try { await updateDoc(doc(db, "pedidos", p.ID_do_Pedido), { Status_do_Pedido: 'Aguardando Retirada' }); } catch(e) {} window.mostrarLoading(false); t = `*Olá ${n}!*\n\n✅ Seu pedido *${p.ID_do_Pedido}* está pronto para retirada!\n\n📅 ${p.Data_Entrega || '--/--/----'}\n⏰ ${p.Horario_Entrega || '--:--'}\n\nAguardamos você! 😊`; } 
    else { t = `Olá ${n}!`; }
    if(num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(t)}`, '_blank'); document.getElementById('whatsapp-confirm-modal').style.display = 'none';
}

window.openDatePicker = function() {
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
    if (window.dataInicialIntervalo && window.dataFinalIntervalo) { window.dataInicialIntervalo = sD; window.dataFinalIntervalo = null; } else if (!window.dataInicialIntervalo) { window.dataInicialIntervalo = sD; window.dataFinalIntervalo = null; } else if (!window.dataFinalIntervalo) { if (sD < window.dataInicialIntervalo) { window.dataFinalIntervalo = new Date(window.dataInicialIntervalo); window.dataInicialIntervalo = sD; } else { if (sD.getTime() === window.dataInicialIntervalo.getTime()) { window.dataInicialIntervalo = null; window.dataFinalIntervalo = null; } else window.dataFinalIntervalo = sD; } }
    window.atualizarDisplayData(); window.renderCalendar();
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
window.selecionarHoje = function() { window.dataInicialIntervalo = new Date(new Date().setHours(0,0,0,0)); window.dataFinalIntervalo = null; window.atualizarDisplayData(); window.renderCalendar(); window.aplicarFiltroData(); }
window.filtrarMesAtual = function() { const hj = new Date(), mA = hj.getMonth(), aA = hj.getFullYear(); window.dataInicialIntervalo = new Date(aA, mA, 1, 0,0,0,0); window.dataFinalIntervalo = new Date(aA, mA + 1, 0, 0,0,0,0); window.atualizarDisplayData(); window.renderCalendar(); window.filtrarPedidos(); window.closeDatePicker(); }
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
                    <button class="btn-action edit" onclick="window.openEditEstoque('${e.id}')"><i class="fas fa-pen"></i></button>
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

async function init() { 
    window.addVariation(false); 
    await syncCats(); 
    await loadProds(); 
    loadAvisos(); 
    loadTema(); 
    loadCarrossel(); 
    window.inicializarKanban(); 
    listenPedidos(); 
}

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
