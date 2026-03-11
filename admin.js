import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const IMGBB_KEY = "25f8ca3ee7fbf1f1a8c0a669d54b9db8";

const app = initializeApp({
    apiKey: "AIzaSyD5JlV7R2w629uiescD4AiixNAr-Qt0qI0",
    authDomain: "favu-app.firebaseapp.com",
    projectId: "favu-app",
    storageBucket: "favu-app.firebasestorage.app",
    messagingSenderId: "793414871188",
    appId: "1:793414871188:web:07ab447df44d742e022c81"
});
const db = getFirestore(app);

let globalCategories = [];
let allProducts = [];
let allAvisos = [];
let currentCategoryFilter = '';

// ==========================================
// ALERTAS E CONFIRMAÇÕES CUSTOMIZADAS
// ==========================================
window.customAlert = function(msg, title = "Sucesso!") {
    document.getElementById('alert-title').textContent = title;
    document.getElementById('alert-msg').textContent = msg;
    document.getElementById('custom-alert').style.display = 'flex';
}

window.customConfirm = function(msg, onConfirm) {
    document.getElementById('confirm-msg').textContent = msg;
    document.getElementById('custom-confirm').style.display = 'flex';
    
    const btn = document.getElementById('confirm-btn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
        document.getElementById('custom-confirm').style.display = 'none';
        if(onConfirm) onConfirm();
    });
}


// ==========================================
// SISTEMA DE LOGIN
// ==========================================
const USUARIOS_PERMITIDOS = [
    { login: "Guilherme Almeida", senha: "01091996" },
    { login: "Flávio Moraes", senha: "16091992" }
];

window.fazerLogin = function() {
    const user = document.getElementById("login-user").value.trim();
    const pass = document.getElementById("login-pass").value.trim();
    const errorMsg = document.getElementById("login-error");

    const validUser = USUARIOS_PERMITIDOS.find(u => u.login === user && u.senha === pass);

    if (validUser) {
        sessionStorage.setItem("favu_admin_logged", "true");
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("admin-panel").style.display = "block";
        init(); 
    } else {
        errorMsg.style.display = "block";
    }
};

window.fazerLogout = function() {
    sessionStorage.removeItem("favu_admin_logged");
    document.getElementById("login-screen").style.display = "block";
    document.getElementById("admin-panel").style.display = "none";
    document.getElementById("login-user").value = "";
    document.getElementById("login-pass").value = "";
    window.toggleMenu(false); 
};

// ==========================================
// FUNÇÕES DE IMAGEM
// ==========================================
async function upImg(file) {
    try {
        const fd = new FormData(); fd.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
        const d = await res.json();
        return d.success ? d.data.url : "";
    } catch(e) { customAlert("Erro no upload da imagem.", "Atenção"); return ""; }
}

window.previewImage = function(input, imgId, btnId, noneId, hiddenFlagId) {
    const file = input.files[0];
    const img = document.getElementById(imgId);
    const btn = btnId ? document.getElementById(btnId) : null;
    const noneTxt = noneId ? document.getElementById(noneId) : null;
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img.src = e.target.result;
            img.style.display = 'block';
            if(btn) btn.style.display = 'inline-block';
            if(noneTxt) noneTxt.style.display = 'none';
        }
        reader.readAsDataURL(file);
        if(hiddenFlagId && document.getElementById(hiddenFlagId)) {
            document.getElementById(hiddenFlagId).value = 'false';
        }
    }
};

window.markImageForRemoval = function(type) {
    if(type === 'prod') {
        document.getElementById('e-img-preview').style.display = 'none';
        document.getElementById('e-img-preview').src = '';
        document.getElementById('btn-remove-e-img').style.display = 'none';
        document.getElementById('e-img-none').style.display = 'block';
        document.getElementById('e-file').value = '';
        document.getElementById('e-file-name').textContent = '';
        document.getElementById('e-remove-img').value = 'true';
    } else if (type === 'aviso') {
        document.getElementById('ea-img-preview').style.display = 'none';
        document.getElementById('ea-img-preview').src = '';
        document.getElementById('btn-remove-ea-img').style.display = 'none';
        document.getElementById('ea-img-none').style.display = 'block';
        document.getElementById('ea-file').value = '';
        document.getElementById('ea-file-name').textContent = '';
        document.getElementById('ea-remove-img').value = 'true';
    }
};


// ==========================================
// AÇÕES EM MASSA (CHECKBOXES)
// ==========================================
window.toggleAll = function(headerCheckbox, type) {
    const checkboxes = document.querySelectorAll(`#tbl-${type} .row-checkbox`);
    checkboxes.forEach(cb => cb.checked = headerCheckbox.checked);
    window.checkSelection(type);
};

window.checkSelection = function(type) {
    const checked = document.querySelectorAll(`#tbl-${type} .row-checkbox:checked`).length;
    const bar = document.getElementById(`bulk-actions-${type}`);
    const count = document.getElementById(`count-${type}`);
    
    count.textContent = checked;
    if(checked > 0) bar.classList.add('active');
    else bar.classList.remove('active');
};

window.bulkToggle = async function(type, status) {
    const checkboxes = document.querySelectorAll(`#tbl-${type} .row-checkbox:checked`);
    if(checkboxes.length === 0) return;
    
    for(let cb of checkboxes) {
        await updateDoc(doc(db, type, cb.value), {ativo: status});
    }
    customAlert(`Status alterado com sucesso!`);
    
    document.querySelector(`#tbl-${type} th .bulk-checkbox`).checked = false;
    document.getElementById(`bulk-actions-${type}`).classList.remove('active');

    if(type === 'produtos') loadProds();
    if(type === 'categorias') syncCats();
    if(type === 'avisos') loadAvisos();
};

window.bulkDelete = function(type) {
    const checkboxes = document.querySelectorAll(`#tbl-${type} .row-checkbox:checked`);
    if(checkboxes.length === 0) return;

    customConfirm(`Excluir permanentemente ${checkboxes.length} item(ns)?`, async () => {
        for(let cb of checkboxes) {
            await deleteDoc(doc(db, type, cb.value));
        }
        customAlert("Itens excluídos!");
        
        document.querySelector(`#tbl-${type} th .bulk-checkbox`).checked = false;
        document.getElementById(`bulk-actions-${type}`).classList.remove('active');

        if(type === 'produtos') loadProds();
        if(type === 'categorias') syncCats();
        if(type === 'avisos') loadAvisos();
    });
};


// ==========================================
// 1. CATEGORIAS
// ==========================================
document.getElementById('search-cat').addEventListener('input', () => { window.renderCatsTable(); });

async function syncCats() {
    const snap = await getDocs(collection(db, "categorias"));
    globalCategories = [];
    snap.forEach(d => { const c = d.data(); c.id = d.id; globalCategories.push(c); });
    window.renderCatsTable();
}

window.renderCatsTable = function() {
    const tb = document.querySelector('#tbl-categorias tbody'); tb.innerHTML = "";
    let opts = `<option value="">Selecione...</option>`;
    const searchTerm = document.getElementById('search-cat').value.toLowerCase();

    const sorted = globalCategories.sort((a,b) => a.nome.localeCompare(b.nome));
    sorted.forEach(c => { opts += `<option value="${c.nome}">${c.nome}</option>`; });

    const filtered = sorted.filter(c => c.nome.toLowerCase().includes(searchTerm));

    filtered.forEach(c => {
        const isAtivo = c.ativo !== false; 
        const eyeIcon = isAtivo ? 'eye' : 'eye-slash';

        tb.innerHTML += `
        <tr>
            <td data-label="Sel:" style="text-align: center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${c.id}" onchange="window.checkSelection('categorias')"></td>
            <td data-label="Categoria:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${c.nome}</strong></td>
            <td data-label="Mín. Total:">${c.minTotal}</td>
            <td data-label="Exibição:">${c.tipoColuna}</td>
            <td data-label="Aviso Destacado:"><small>${c.mensagemObs || '-'}</small></td>
            <td data-label="Status:"><span class="badge ${isAtivo ? 'ativo' : 'inativo'}">${isAtivo ? 'Ativa' : 'Oculta'}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditCat('${c.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-action toggle" onclick="window.togC('${c.id}', ${!isAtivo})"><i class="fas fa-${eyeIcon}"></i></button>
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
    document.getElementById('ec-obs').value = c.mensagemObs || ''; 
    window.openModal('modal-editar-cat');
};

document.getElementById('form-edit-cat').onsubmit = async(e) => {
    e.preventDefault(); const id = document.getElementById('ec-id').value;
    await updateDoc(doc(db, "categorias", id), { nome: document.getElementById('ec-nome').value.trim(), minTotal: parseInt(document.getElementById('ec-min').value)||0, tipoColuna: document.getElementById('ec-col').value, mensagemObs: document.getElementById('ec-obs').value.trim() });
    customAlert("Categoria Atualizada!"); window.closeModal('modal-editar-cat', 'form-edit-cat'); syncCats(); loadProds();
};
window.togC = async(id, s) => { await updateDoc(doc(db, "categorias", id), {ativo: s}); syncCats(); };
window.delC = async(id) => { customConfirm("Excluir categoria?", async () => { await deleteDoc(doc(db, "categorias", id)); syncCats(); loadProds(); }); };

// ==========================================
// 2. PRODUTOS E VARIAÇÕES
// ==========================================

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
    
    const hasOthers = container.children.length > 0;
    const btnRemove = (isSizeCategory && hasOthers) ? `<button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: white; color: #E60000; border: 1px solid #E60000; border-radius: 5px; font-size: 0.8rem; cursor: pointer; padding: 2px 8px;">Remover <i class="fas fa-times"></i></button>` : '';

    const sizeFieldHtml = isSizeCategory ? `<div><label>Tamanho</label><input type="text" class="v-tam" placeholder="Ex: (P - 1,5kg)" required></div>` : `<div style="display:none;"><input type="hidden" class="v-tam" value=""></div>`;

    div.innerHTML = `
        ${btnRemove}
        <div class="form-grid" style="grid-template-columns: ${isSizeCategory ? '1fr 1fr' : '1fr'}; margin-bottom: 10px;">
            ${sizeFieldHtml}
            <div><label>Preço (R$)</label><input type="number" step="0.01" class="v-preco" required></div>
        </div>
        <div>
            <label>Descrição do Resumo ${isSizeCategory ? '' : ''}</label><textarea class="v-dres" rows="1" required placeholder="${isSizeCategory ? 'Ex: Bolo de Ameixa - P' : 'Descrição para o resumo do pedido'}"></textarea>
        </div>
    `;
    container.appendChild(div);
};

document.getElementById('form-add-prod').onsubmit = async(e) => {
    e.preventDefault(); 
    const btn = e.target.querySelector('button[type="submit"]'); 
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; 
    btn.disabled = true;
    try {
        let url = ""; const f = document.getElementById('a-file').files[0]; 
        if(f) url = await upImg(f);

        const nomeBase = document.getElementById('a-nome').value.trim();
        const categoriaBase = document.getElementById('a-cat').value;
        const minBase = parseInt(document.getElementById('a-min').value)||1;
        const descMenuBase = document.getElementById('a-dmenu').value.trim();
        const descPopupBase = document.getElementById('a-dpop').value.trim();

        const variations = document.querySelectorAll('.variation-block');
        for(let v of variations) {
            const tam = v.querySelector('.v-tam').value.trim();
            const preco = parseFloat(v.querySelector('.v-preco').value)||0;
            const descRes = v.querySelector('.v-dres').value.trim();

            await addDoc(collection(db, "produtos"), {
                nome: nomeBase, categoria: categoriaBase, min: minBase, 
                descricaoItem: descMenuBase, descricaoPopup: descPopupBase, 
                imagemUrl: url, ativo: true,
                tamanho: tam, preco: preco, descricaoResumo: descRes
            });
        }
        customAlert("Item(ns) Adicionado(s)!"); 
        window.closeModal('modal-add-prod', 'form-add-prod');
        loadProds();
    } catch(err) { console.error(err); customAlert("Erro ao salvar.", "Erro"); } 
    finally { btn.innerHTML = 'Salvar Novo Produto'; btn.disabled = false; }
};


// ==========================================
// LOTE INTELIGENTE
// ==========================================
window.handleBulkCategoryChange = (selectElement) => {
    const catObj = globalCategories.find(c => c.nome === selectElement.value);
    const row = selectElement.closest('.grid-row');
    const container = row.querySelector('.b-variations-container');
    const addBtn = container.querySelector('.add-bulk-var-btn');
    const tamInputs = container.querySelectorAll('.b-tam');

    if (catObj && catObj.tipoColuna === 'Tamanho') {
        tamInputs.forEach(i => { i.disabled = false; i.placeholder = "Tam"; i.type = "text"; });
        if(addBtn) addBtn.style.display = 'inline-block';
    } else {
        const varRows = container.querySelectorAll('.b-var-row');
        if(varRows.length > 1) { for(let i=1; i<varRows.length; i++) varRows[i].remove(); }
        tamInputs[0].disabled = true; tamInputs[0].value = ""; tamInputs[0].placeholder = "-";
        if(addBtn) addBtn.style.display = 'none';
    }
};

window.addBulkVariation = (btn) => {
    const container = btn.closest('.b-variations-container');
    const div = document.createElement('div');
    div.className = 'b-var-row';
    div.style = "display:flex; gap:5px; align-items:center; margin-top:5px;";
    div.innerHTML = `
        <input type="text" class="b-tam" placeholder="Tam" style="width:60px;">
        <input type="number" step="0.01" class="b-preco" placeholder="R$" style="width:75px;">
        <input type="text" class="b-dres" placeholder="Desc. Resumo" style="flex:1;">
        <button type="button" onclick="this.parentElement.remove()" style="background:#fcc; border:none; border-radius:4px; cursor:pointer; width:28px; height:28px; font-weight:bold; color:#E60000;" title="Remover Tamanho">&times;</button>
    `;
    container.appendChild(div);
};

window.addGridRow = () => {
    const c = document.getElementById('bulk-rows'); const d = document.createElement('div'); d.className = 'grid-row';
    let opts = `<option value="">Categoria...</option>`; globalCategories.forEach(cat => opts += `<option value="${cat.nome}">${cat.nome}</option>`);
    
    d.innerHTML = `
        <div>
            <label class="bulk-file-upload" title="Escolher Foto">
                <i class="fas fa-camera" style="font-size: 1.2rem;"></i>
                <input type="file" class="b-file" accept="image/*" onchange="this.parentElement.classList.add('has-file');">
            </label>
        </div>
        <div><select class="b-cat cat-select" onchange="window.handleBulkCategoryChange(this)">${opts}</select></div>
        <div><input type="text" class="b-nome" placeholder="Nome Produto"></div>
        <div><input type="number" class="b-min" value="1"></div>
        <div><textarea class="b-dmenu" rows="2" placeholder="Desc. Produto"></textarea></div>
        <div><textarea class="b-dpop" rows="2" placeholder="Desc. Imagem"></textarea></div>
        <div class="b-variations-container" style="display:flex; flex-direction:column;">
            <div class="b-var-row" style="display:flex; gap:5px; align-items:center;">
                <input type="text" class="b-tam" placeholder="(P - 1,5KG)" style="width:60px;" disabled>
                <input type="number" step="0.01" class="b-preco" placeholder="R$" style="width:75px;">
                <input type="text" class="b-dres" placeholder="Desc. Resumo" style="flex:1;">
                <button type="button" class="add-bulk-var-btn" onclick="window.addBulkVariation(this)" style="background:#eee; border:none; border-radius:4px; cursor:pointer; width:28px; height:28px; font-weight:bold; color:var(--favu-rust); display:none;" title="Adicionar Tamanho">+</button>
            </div>
        </div>
        <div style="display:flex; justify-content:center; padding-top:5px;">
            <button type="button" onclick="this.parentElement.remove()" style="background:none; color:#E60000; border:none; cursor:pointer; font-size:1.4rem;" title="Remover Linha Inteira"><i class="fas fa-times-circle"></i></button>
        </div>
    `; c.appendChild(d);
};

window.saveBulkItems = async() => {
    const btn = document.getElementById('btn-save-bulk'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subindo fotos...'; btn.disabled = true;
    try {
        for(let r of document.querySelectorAll('#bulk-rows .grid-row')) {
            const nm = r.querySelector('.b-nome').value.trim(); if(!nm) continue;
            let url = ""; const f = r.querySelector('.b-file').files[0]; if(f) url = await upImg(f);
            const cat = r.querySelector('.b-cat').value;
            const min = parseInt(r.querySelector('.b-min').value)||1;
            const dmenu = r.querySelector('.b-dmenu').value.trim();
            const dpop = r.querySelector('.b-dpop').value.trim();

            const varRows = r.querySelectorAll('.b-var-row');
            for (let vr of varRows) {
                const tam = vr.querySelector('.b-tam').value.trim();
                const preco = parseFloat(vr.querySelector('.b-preco').value)||0;
                const dres = vr.querySelector('.b-dres').value.trim();

                await addDoc(collection(db, "produtos"), {
                    nome: nm, categoria: cat, min: min,
                    descricaoItem: dmenu, descricaoPopup: dpop, imagemUrl: url, ativo: true,
                    tamanho: tam, preco: preco, descricaoResumo: dres
                });
            }
        }
        customAlert("Lote adicionado!"); document.getElementById('bulk-rows').innerHTML = ''; document.getElementById('modal-bulk-prod').style.display='none'; loadProds();
    } catch(err) { console.error(err); customAlert("Erro.", "Erro"); } finally { btn.innerHTML = 'Salvar'; btn.disabled = false; }
};

document.getElementById('search-prod').addEventListener('input', () => { window.renderProdsTable(); });

async function loadProds() {
    const s = await getDocs(collection(db, "produtos"));
    allProducts = []; s.forEach(d => allProducts.push({id: d.id, ...d.data()}));
    renderProdTabs(); window.renderProdsTable();
}

function renderProdTabs() {
    const container = document.getElementById('prod-cats-nav');
    const catsUsed = [...new Set(allProducts.map(p => p.categoria || 'Sem Categoria'))].sort((a,b) => a.localeCompare(b));
    if (!currentCategoryFilter || !catsUsed.includes(currentCategoryFilter)) currentCategoryFilter = catsUsed[0] || '';
    let html = '';
    catsUsed.forEach(c => { html += `<button class="prod-tab-btn ${currentCategoryFilter === c ? 'active' : ''}" onclick="window.filterProds('${c}')">${c}</button>`; });
    container.innerHTML = html;
}

window.filterProds = function(cat) { currentCategoryFilter = cat; renderProdTabs(); window.renderProdsTable(); }

window.renderProdsTable = function() {
    const searchTerm = document.getElementById('search-prod').value.toLowerCase();
    const tb = document.querySelector("#tbl-produtos tbody"); tb.innerHTML = "";
    
    let filtered = allProducts;
    if (searchTerm) {
        filtered = allProducts.filter(p => p.nome.toLowerCase().includes(searchTerm));
    } else {
        filtered = allProducts.filter(p => (p.categoria || 'Sem Categoria') === currentCategoryFilter);
    }

    filtered.sort((a,b)=>a.nome.localeCompare(b.nome)).forEach(p => {
        const imgTag = p.imagemUrl ? `<img src="${p.imagemUrl}" class="img-preview">` : `<div class="img-preview" style="background:#eee; display:flex; align-items:center; justify-content:center;"><i class="fas fa-image" style="color:#ccc;"></i></div>`;
        const eyeIcon = p.ativo ? 'eye' : 'eye-slash';

        tb.innerHTML += `
        <tr>
            <td data-label="Sel:" style="text-align: center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${p.id}" onchange="window.checkSelection('produtos')"></td>
            <td data-label="Foto:">${imgTag}</td>
            <td data-label="Nome:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${p.nome}</strong></td>
            <td data-label="Categoria:">${p.categoria}</td>
            <td data-label="Tam:">${p.tamanho||'-'}</td>
            <td data-label="Mín:">${p.min||1}</td>
            <td data-label="Preço:">R$ ${p.preco.toFixed(2)}</td>
            <td data-label="Tabela:"><small>${p.descricaoItem||'-'}</small></td>
            <td data-label="WhatsApp:"><small>${p.descricaoResumo||'-'}</small></td>
            <td data-label="Desc. Imagem:"><small>${p.descricaoPopup||'-'}</small></td>
            <td data-label="Status:"><span class="badge ${p.ativo?'ativo':'inativo'}">${p.ativo?'Visível':'Oculto'}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditor('${p.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-action toggle" onclick="window.togP('${p.id}', ${!p.ativo})"><i class="fas fa-${eyeIcon}"></i></button>
                    <button class="btn-action del" onclick="window.delP('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

window.openEditor = async(id) => {
    const p = (await getDoc(doc(db,"produtos",id))).data();
    document.getElementById('e-id').value = id; 
    document.getElementById('e-nome').value = p.nome; 
    document.getElementById('e-cat').value = p.categoria; 
    document.getElementById('e-preco').value = p.preco; 
    document.getElementById('e-min').value = p.min||1; 
    document.getElementById('e-dmenu').value = p.descricaoItem||''; 
    document.getElementById('e-dres').value = p.descricaoResumo||''; 
    document.getElementById('e-dpop').value = p.descricaoPopup||''; 
    
    const catObj = globalCategories.find(c => c.nome === p.categoria);
    if (catObj && catObj.tipoColuna === 'Tamanho') {
        document.getElementById('e-tam-container').style.display = 'block';
        document.getElementById('e-tam').value = p.tamanho||'';
    } else {
        document.getElementById('e-tam-container').style.display = 'none';
        document.getElementById('e-tam').value = '';
    }
    
    const imgPreview = document.getElementById('e-img-preview');
    const btnRemove = document.getElementById('btn-remove-e-img');
    const imgNone = document.getElementById('e-img-none');
    document.getElementById('e-remove-img').value = 'false';
    document.getElementById('e-file').value = ''; 
    document.getElementById('e-file-name').textContent = ''; 

    if (p.imagemUrl && p.imagemUrl.trim() !== '') {
        imgPreview.src = p.imagemUrl;
        imgPreview.style.display = 'block';
        btnRemove.style.display = 'inline-block';
        imgNone.style.display = 'none';
    } else {
        imgPreview.src = '';
        imgPreview.style.display = 'none';
        btnRemove.style.display = 'none';
        imgNone.style.display = 'block';
    }
    
    window.openModal('modal-editar-prod');
};

document.getElementById('e-cat').addEventListener('change', function() {
    const catObj = globalCategories.find(c => c.nome === this.value);
    if (catObj && catObj.tipoColuna === 'Tamanho') {
        document.getElementById('e-tam-container').style.display = 'block';
    } else {
        document.getElementById('e-tam-container').style.display = 'none';
        document.getElementById('e-tam').value = '';
    }
});

document.getElementById('form-edit-prod').onsubmit = async(e) => {
    e.preventDefault(); const id = document.getElementById('e-id').value;
    const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        const data = { nome: document.getElementById('e-nome').value, categoria: document.getElementById('e-cat').value, tamanho: document.getElementById('e-tam').value, preco: parseFloat(document.getElementById('e-preco').value)||0, min: parseInt(document.getElementById('e-min').value)||1, descricaoItem: document.getElementById('e-dmenu').value, descricaoResumo: document.getElementById('e-dres').value, descricaoPopup: document.getElementById('e-dpop').value };
        
        const f = document.getElementById('e-file').files[0]; 
        const removeImg = document.getElementById('e-remove-img').value === 'true';

        if (f) {
            data.imagemUrl = await upImg(f);
        } else if (removeImg) {
            data.imagemUrl = ""; 
        }

        await updateDoc(doc(db, "produtos", id), data); 
        customAlert("Produto Atualizado!"); window.closeModal('modal-editar-prod', 'form-edit-prod'); loadProds(); 
    } catch(err) { console.error(err); customAlert("Erro ao editar.", "Erro"); } finally { btn.innerHTML = 'Salvar Alterações'; btn.disabled = false; }
};

window.togP = async(id, s) => { await updateDoc(doc(db, "produtos", id), {ativo:s}); loadProds(); };
window.delP = async(id) => { customConfirm("Excluir item permanentemente?", async () => { await deleteDoc(doc(db, "produtos", id)); loadProds(); }); };

// ==========================================
// 3. AVISOS COM STATUS DINÂMICOS
// ==========================================
document.getElementById('search-aviso').addEventListener('input', () => { window.renderAvisosTable(); });

document.getElementById('form-add-aviso').onsubmit = async(e) => {
    e.preventDefault(); const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...'; btn.disabled = true;
    try {
        let url = ""; const f = document.getElementById('aa-file').files[0]; if(f) url = await upImg(f);
        const ini = new Date(`${document.getElementById('aa-inid').value}T${document.getElementById('aa-inih').value}`).getTime();
        const fim = new Date(`${document.getElementById('aa-fimd').value}T${document.getElementById('aa-fimh').value}`).getTime();
        await addDoc(collection(db, "avisos"), { titulo: document.getElementById('aa-tit').value, texto: document.getElementById('aa-txt').value, inicio: ini, fim: fim, imagemUrl: url, ativo: true });
        customAlert("Comunicado Agendado!"); window.closeModal('modal-add-aviso', 'form-add-aviso'); loadAvisos();
    } catch(err) { console.error(err); customAlert("Erro.", "Erro"); } finally { btn.innerHTML = 'Agendar Aviso'; btn.disabled = false; }
};

async function loadAvisos() {
    const s = await getDocs(collection(db, "avisos"));
    allAvisos = []; s.forEach(d => allAvisos.push({id: d.id, ...d.data()}));
    window.renderAvisosTable();
}

window.renderAvisosTable = function() {
    const tb = document.querySelector("#tbl-avisos tbody"); tb.innerHTML = "";
    const searchTerm = document.getElementById('search-aviso').value.toLowerCase();
    const filtered = allAvisos.filter(a => a.titulo.toLowerCase().includes(searchTerm) || a.texto.toLowerCase().includes(searchTerm));

    filtered.forEach(a => {
        const isAtivo = a.ativo !== false; const agora = Date.now();
        let st = ""; let stClass = "";
        
        if(!isAtivo) {
            st = "Oculto / Pausado"; stClass = "inativo";
        } else {
            if(agora < a.inicio) { st = "Agendado"; stClass = "agendado"; }
            else if (agora >= a.inicio && agora <= a.fim) { st = "Em andamento"; stClass = "ativo"; }
            else { st = "Concluso"; stClass = "concluso"; }
        }

        const eyeIcon = isAtivo ? 'eye' : 'eye-slash';
        const imgTag = a.imagemUrl ? `<img src="${a.imagemUrl}" class="img-preview">` : `<div class="img-preview" style="background:#eee; display:flex; align-items:center; justify-content:center;"><i class="fas fa-bullhorn" style="color:#ccc;"></i></div>`;

        tb.innerHTML += `
        <tr>
            <td data-label="Sel:" style="text-align: center;"><input type="checkbox" class="bulk-checkbox row-checkbox" value="${a.id}" onchange="window.checkSelection('avisos')"></td>
            <td data-label="Capa:">${imgTag}</td>
            <td data-label="Título:"><strong style="color:var(--favu-rust); font-size:1.1rem;">${a.titulo}</strong></td>
            <td data-label="Mensagem:"><small>${a.texto}</small></td>
            <td data-label="Início:">${new Date(a.inicio).toLocaleString()}</td>
            <td data-label="Fim:">${new Date(a.fim).toLocaleString()}</td>
            <td data-label="Status:"><span class="badge ${stClass}">${st}</span></td>
            <td data-label="Ações:">
                <div class="action-btns-wrapper">
                    <button class="btn-action edit" onclick="window.openEditAviso('${a.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-action toggle" onclick="window.togA('${a.id}', ${!isAtivo})"><i class="fas fa-${eyeIcon}"></i></button>
                    <button class="btn-action del" onclick="window.delDoc('avisos','${a.id}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    });
}

window.openEditAviso = async(id) => {
    const a = (await getDoc(doc(db,"avisos",id))).data();
    document.getElementById('ea-id').value = id; document.getElementById('ea-tit').value = a.titulo; document.getElementById('ea-txt').value = a.texto;
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const dIni = new Date(a.inicio - tzOffset); document.getElementById('ea-inid').value = dIni.toISOString().split('T')[0]; document.getElementById('ea-inih').value = dIni.toISOString().split('T')[1].slice(0,5);
    const dFim = new Date(a.fim - tzOffset); document.getElementById('ea-fimd').value = dFim.toISOString().split('T')[0]; document.getElementById('ea-fimh').value = dFim.toISOString().split('T')[1].slice(0,5);
    
    const imgPreview = document.getElementById('ea-img-preview');
    const btnRemove = document.getElementById('btn-remove-ea-img');
    const imgNone = document.getElementById('ea-img-none');
    document.getElementById('ea-remove-img').value = 'false';
    document.getElementById('ea-file').value = ''; 
    document.getElementById('ea-file-name').textContent = ''; 

    if (a.imagemUrl && a.imagemUrl.trim() !== '') {
        imgPreview.src = a.imagemUrl; imgPreview.style.display = 'block';
        btnRemove.style.display = 'inline-block'; imgNone.style.display = 'none';
    } else {
        imgPreview.src = ''; imgPreview.style.display = 'none';
        btnRemove.style.display = 'none'; imgNone.style.display = 'block';
    }

    window.openModal('modal-editar-aviso');
};

document.getElementById('form-edit-aviso').onsubmit = async(e) => {
    e.preventDefault(); const id = document.getElementById('ea-id').value; const btn = e.target.querySelector('button[type="submit"]'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...'; btn.disabled = true;
    try {
        let data = { titulo: document.getElementById('ea-tit').value, texto: document.getElementById('ea-txt').value, inicio: new Date(`${document.getElementById('ea-inid').value}T${document.getElementById('ea-inih').value}`).getTime(), fim: new Date(`${document.getElementById('ea-fimd').value}T${document.getElementById('ea-fimh').value}`).getTime() };
        
        const f = document.getElementById('ea-file').files[0]; 
        const removeImg = document.getElementById('ea-remove-img').value === 'true';

        if (f) { data.imagemUrl = await upImg(f); } 
        else if (removeImg) { data.imagemUrl = ""; }

        await updateDoc(doc(db, "avisos", id), data); customAlert("Aviso atualizado!"); window.closeModal('modal-editar-aviso', 'form-edit-aviso'); loadAvisos();
    } catch(e) { console.error(e); } finally { btn.innerHTML = 'Salvar Alterações'; btn.disabled = false; }
};
window.togA = async(id, s) => { await updateDoc(doc(db, "avisos", id), {ativo: s}); loadAvisos(); };

async function loadTema() {
    const t = await getDoc(doc(db, "config", "tema"));
    if(t.exists()) {
        const d = t.data();
        if(d.bg) document.getElementById('cor-bg').value = d.bg;
        if(d.card) document.getElementById('cor-card').value = d.card;
        if(d.txt) document.getElementById('cor-txt').value = d.txt;
        if(d.acc) document.getElementById('cor-acc').value = d.acc;
    }
}
document.getElementById('form-cores').onsubmit = async(e) => {
    e.preventDefault(); await setDoc(doc(db, "config", "tema"), { bg: document.getElementById('cor-bg').value, card: document.getElementById('cor-card').value, txt: document.getElementById('cor-txt').value, acc: document.getElementById('cor-acc').value });
    customAlert("Identidade visual aplicada aos sites!");
};

document.getElementById('form-carrossel').onsubmit = async(e) => {
    e.preventDefault(); const btn = document.getElementById('btn-up-car'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...'; btn.disabled = true;
    try { 
        const s = await getDocs(collection(db, "carrossel"));
        let count = s.size;
        for(let f of document.getElementById('car-files').files) { 
            let url = await upImg(f); 
            if(url) {
                await addDoc(collection(db, "carrossel"), { url: url, order: count }); 
                count++;
            }
        }
        customAlert("Carrossel Atualizado!"); loadCarrossel(); e.target.reset(); document.getElementById('car-file-name').textContent = 'Nenhum arquivo escolhido';
    } catch(err) { console.error(err); } finally { btn.innerHTML = '<i class="fas fa-upload"></i> Adicionar ao Carrossel'; btn.disabled = false; }
};

// DRAG AND DROP DO CARROSSEL
let dragSrcEl = null;

window.handleDragStart = function(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
};

window.handleDragOver = function(e) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; return false;
};

window.handleDrop = async function(e) {
    e.preventDefault();
    if (dragSrcEl != this) {
        const parent = this.parentNode;
        parent.insertBefore(dragSrcEl, this);
        
        const items = document.querySelectorAll('.carrossel-item');
        for (let i = 0; i < items.length; i++) {
            const id = items[i].getAttribute('data-id');
            await updateDoc(doc(db, 'carrossel', id), { order: i });
        }
    }
    return false;
};

window.handleDragEnd = function(e) { this.classList.remove('dragging'); }

async function loadCarrossel() {
    const s = await getDocs(collection(db, "carrossel")); const div = document.getElementById("galeria-preview"); div.innerHTML = "";
    
    let arr = [];
    s.forEach(d => arr.push({id: d.id, ...d.data()}));
    arr.sort((a,b) => (a.order || 0) - (b.order || 0));

    arr.forEach(d => { 
        div.innerHTML += `
        <div class="carrossel-item" data-id="${d.id}" draggable="true" ondragstart="window.handleDragStart.call(this, event)" ondragover="window.handleDragOver.call(this, event)" ondrop="window.handleDrop.call(this, event)" ondragend="window.handleDragEnd.call(this, event)">
            <img src="${d.url}" style="width:120px; height:120px; object-fit:cover; border-radius:15px; border:2px solid var(--favu-rust);">
            <button type="button" style="position:absolute; top:-8px; right:-8px; background:#E60000; color:white; border:none; border-radius:50%; width:25px; height:25px; cursor:pointer;" onclick="window.delDoc('carrossel','${d.id}')"><i class="fas fa-times"></i></button>
        </div>`; 
    });
}

window.delDoc = async(col, id) => { customConfirm("Excluir definitivamente?", async () => { await deleteDoc(doc(db, col, id)); if(col==='avisos') loadAvisos(); if(col==='carrossel') loadCarrossel(); }); };

async function init() { 
    window.addVariation(false); 
    await syncCats(); await loadProds(); loadAvisos(); loadTema(); loadCarrossel(); 
}

if (sessionStorage.getItem("favu_admin_logged") === "true") {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("admin-panel").style.display = "block";
    init();
}