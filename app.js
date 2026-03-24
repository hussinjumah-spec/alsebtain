// --- CONSTANTS & STATE --- //
const STATE = {
    passengers: JSON.parse(localStorage.getItem('passengers') || '[]'),
    payments: JSON.parse(localStorage.getItem('payments') || '[]'),
    sheetUrl: localStorage.getItem('googleSheetUrl') || ''
};

function saveData() {
    localStorage.setItem('passengers', JSON.stringify(STATE.passengers));
    localStorage.setItem('payments', JSON.stringify(STATE.payments));
}

// Generate unique ID
function generateId(prefix) {
    return prefix + '-' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// --- INDEXEDDB SETUP FOR ATTACHMENTS --- //
let dbPromise;
async function initDB() {
    if (!window.idb) {
        console.warn('IDB library not loaded!');
        return;
    }
    dbPromise = idb.openDB('TravelAgencyDB', 1, {
        upgrade(db) {
            if (!db.objectStoreNames.contains('attachments')) {
                db.createObjectStore('attachments');
            }
        },
    });
}

const fileToBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve({ name: file.name, type: file.type, data: reader.result });
    reader.onerror = error => reject(error);
});

// --- INITIALIZATION --- //
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    initTheme();
    initNavigation();
    initForms();
    renderLists();
    populateAutocomplete();
    updateNewFileNumbers();
    initFilters();
    initSignaturePad();
    if (typeof LOGO_BASE64 !== 'undefined') {
        const sl = document.getElementById('sidebar-logo');
        if (sl) sl.src = LOGO_BASE64;
    }

    // Attachment Preview Listeners
    initFilePreviews();
});

function initFilePreviews() {
    ['attachments', 'edit-attachments'].forEach(id => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('change', function() {
            const previewContainerId = id === 'attachments' ? 'attachment-preview' : 'edit-attachment-preview';
            const container = document.getElementById(previewContainerId);
            if (id === 'attachments') container.innerHTML = ''; // Clear only for new entries
            
            Array.from(this.files).forEach(file => {
                const reader = new FileReader();
                reader.onload = e => {
                    const isImage = file.type.startsWith('image/');
                    const previewItem = document.createElement('div');
                    previewItem.style.cssText = "border:1px solid var(--border-color); padding:5px; border-radius:5px; text-align:center; position:relative; background:var(--light-bg); width:70px;";
                    previewItem.innerHTML = `
                        ${isImage ? `<img src="${e.target.result}" style="height:50px; max-width:60px; object-fit:cover; display:block; margin:auto">` : `<i class="fas fa-file-pdf" style="font-size:30px; color:var(--danger-color)"></i>`}
                        <div style="font-size:9px; margin-top:3px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${file.name}</div>
                    `;
                    container.appendChild(previewItem);
                };
                reader.readAsDataURL(file);
            });
        });
    });
}

// --- THEME MANAGEMENT --- //
function initTheme() {
    const themeBtn = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    
    if (savedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeBtn.addEventListener('click', () => {
        const isDark = document.body.hasAttribute('data-theme');
        if (isDark) {
            document.body.removeAttribute('data-theme');
            themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            themeBtn.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        }
    });
}

// --- NAVIGATION --- //
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            // Remove active classes
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            // Add active class
            item.classList.add('active');
            const target = item.getAttribute('data-target');
            document.getElementById(target).classList.add('active');

            if (target === 'lists-section') renderLists();
            if (target === 'payments-section') {
                updateNewFileNumbers();
                renderReceipts();
                populatePaymentPassengers();
            }
        });
    });
}

// --- FORM HANDLING --- //
function initForms() {
    // Passenger Form
    const pForm = document.getElementById('passenger-form');
    pForm.addEventListener('submit', handlePassengerSubmit);

    // New Trip Button
    document.getElementById('btn-new-trip').addEventListener('click', () => {
        document.getElementById('trip-name').value = '';
        document.getElementById('list-name').value = '';
        document.getElementById('trip-name').focus();
    });

    // Payment Form
    const payForm = document.getElementById('payment-form');
    payForm.addEventListener('submit', handlePaymentSubmit);

    // Calculate Remaining Amount automatically
    document.getElementById('pay-total').addEventListener('input', calculateRemaining);
    document.getElementById('pay-paid').addEventListener('input', calculateRemaining);

    // Auto-fill payment details when passenger selected
    document.getElementById('pay-passenger-select').addEventListener('change', handlePassengerSelectForPayment);

    // Export All Button
    document.getElementById('btn-export-all').addEventListener('click', exportAllToExcel);

    // Move Modal Logic
    document.querySelector('.close-modal').addEventListener('click', closeModal);
    document.querySelector('.close-modal-btn').addEventListener('click', closeModal);
    document.getElementById('btn-confirm-move').addEventListener('click', confirmMovePassenger);

    // Edit Modal Logic
    document.querySelector('.close-edit-modal').addEventListener('click', closeEditModal);
    document.querySelector('.close-edit-btn').addEventListener('click', closeEditModal);
    document.getElementById('edit-passenger-form').addEventListener('submit', handleEditSubmit);

    // View Attachments Modal Logic
    document.querySelector('.close-att-modal').addEventListener('click', closeAttModal);
    document.querySelector('.close-att-btn').addEventListener('click', closeAttModal);

    // Payment Export
    document.getElementById('btn-export-payments').addEventListener('click', exportPaymentsToExcel);

    // Edit Receipt Modal Logic
    document.querySelector('.close-edit-receipt-modal').addEventListener('click', closeEditReceiptModal);
    document.querySelector('.close-edit-receipt-btn').addEventListener('click', closeEditReceiptModal);
    document.getElementById('edit-payment-form').addEventListener('submit', handleEditReceiptSubmit);
    document.getElementById('edit-pay-total').addEventListener('input', calculateEditRemaining);
    document.getElementById('edit-pay-paid').addEventListener('input', calculateEditRemaining);

    // Bulk WhatsApp Modal
    document.querySelector('.close-bulk-wa-modal').addEventListener('click', closeBulkWAModal);
    document.querySelector('.close-bulk-wa-btn').addEventListener('click', closeBulkWAModal);

    // Backup & Restore
    document.getElementById('btn-backup-export').addEventListener('click', performBackup);
    document.getElementById('backup-file-input').addEventListener('change', performRestore);

    // Google Sheets Sync Setup
    const sheetInput = document.getElementById('google-sheets-url');
    if (sheetInput) {
        sheetInput.value = STATE.sheetUrl;
        document.getElementById('btn-save-sheet-url').addEventListener('click', () => {
            const val = sheetInput.value.trim();
            localStorage.setItem('googleSheetUrl', val);
            STATE.sheetUrl = val;
            Swal.fire('تم الحفظ', 'تم حفظ رابط Google Sheets بنجاح! سيتم الآن إرسال بيانات أي مسافر أو رصيد جديد تلقائياً إلى السحابة.', 'success');
        });
        
        const btnSync = document.getElementById('btn-sync-cloud');
        if (btnSync) {
            btnSync.addEventListener('click', async () => {
                if (!STATE.sheetUrl) {
                    Swal.fire('تنبيه', 'يرجى لصق وحفظ رابط السحابة التابع لجوجل أولاً', 'warning');
                    return;
                }
                try {
                    Swal.fire({ title: 'جاري جلب البيانات...', text: 'يتم الآن استيراد المسافرين والأرصدة من Google Sheets. قد يستغرق ذلك ثوانٍ معدودة.', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
                    const res = await fetch(STATE.sheetUrl);
                    if (!res.ok) throw new Error('خطأ في الاتصال بالرابط');
                    const data = await res.json();
                    
                    if (data && data.passengers && data.payments) {
                        STATE.passengers = data.passengers;
                        STATE.payments = data.payments;
                        saveData();
                        
                        // Sync Attachments to IndexedDB if provided
                        if (data.attachments && dbPromise) {
                            const db = await dbPromise;
                            for (const [pId, atts] of Object.entries(data.attachments)) {
                                await db.put('attachments', atts, pId);
                            }
                        }

                        renderLists();
                        renderReceipts();
                        populateAutocomplete();
                        Swal.fire('اكتمل الاستيراد والتحديث', `تم بنجاح جلب ${data.passengers.length} مسافر و ${data.payments.length} رصيد من السحابة!`, 'success');
                    } else {
                        throw new Error('بيانات غير متوافقة');
                    }
                } catch(e) {
                    console.error(e);
                    Swal.fire('خطأ في الاستيراد', 'فشل استيراد البيانات! تأكد من أن الرابط صحيح وأنك حَدّثت السكربت وأضفت دالة الجلب (doGet) للملف.', 'error');
                }
            });
        }
    }
}

// Google Sheets Request Function
async function sendToGoogleSheets(payload) {
    if (!STATE.sheetUrl) return;
    try {
        fetch(STATE.sheetUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    } catch (e) {
        console.error('Google Sheets Sync Failed:', e);
    }
}

function updateNewFileNumbers() {
    document.getElementById('file-number-display').innerText = generateId('FILE');
    document.getElementById('receipt-number-display').innerText = generateId('REC');
}

// --- SIGNATURE PAD --- //
let sigCanvas, sigCtx, isDrawing = false;
let sigEmpty = true;

function initSignaturePad() {
    sigCanvas = document.getElementById('signature-pad');
    if (!sigCanvas) return;
    
    function resizeCanvas() {
        if(!sigCanvas.offsetWidth) return;
        const ratio =  Math.max(window.devicePixelRatio || 1, 1);
        sigCanvas.width = sigCanvas.offsetWidth * ratio;
        sigCanvas.height = sigCanvas.offsetHeight * ratio;
        sigCtx = sigCanvas.getContext('2d');
        sigCtx.scale(ratio, ratio);
        sigCtx.lineWidth = 4.5;
        sigCtx.lineCap = 'round';
        sigCtx.strokeStyle = '#000033'; // Dark blue ink
        sigEmpty = true;
    }
    
    setTimeout(resizeCanvas, 300);
    window.addEventListener('resize', resizeCanvas);
    
    function getPos(e) {
        const rect = sigCanvas.getBoundingClientRect();
        let clientX = e.clientX;
        let clientY = e.clientY;
        if(e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        }
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    }
    
    function startDraw(e) {
        if(e.type === 'touchstart') {
            // Only prevent default if we are drawing, allow scroll occasionally?
            // Actually, prevent to ensure smooth drawing
            e.preventDefault(); 
        }
        isDrawing = true;
        const pos = getPos(e);
        sigCtx.beginPath();
        sigCtx.moveTo(pos.x, pos.y);
    }
    
    function draw(e) {
        if(!isDrawing) return;
        if(e.type === 'touchmove') e.preventDefault();
        const pos = getPos(e);
        sigCtx.lineTo(pos.x, pos.y);
        sigCtx.stroke();
        sigEmpty = false;
    }
    
    function stopDraw() {
        if(!isDrawing) return;
        isDrawing = false;
        sigCtx.closePath();
    }
    
    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', draw);
    window.addEventListener('mouseup', stopDraw);
    
    sigCanvas.addEventListener('touchstart', startDraw, {passive: false});
    sigCanvas.addEventListener('touchmove', draw, {passive: false});
    window.addEventListener('touchend', stopDraw);
    window.addEventListener('touchcancel', stopDraw);
    
    document.getElementById('btn-clear-signature').addEventListener('click', () => {
        sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
        sigEmpty = true;
    });

    const navItems = document.querySelectorAll('.nav-links li');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
             if(item.getAttribute('data-target') === 'payments-section') {
                 setTimeout(resizeCanvas, 150);
             }
        });
    });
}

async function saveAttachmentsToDB(passengerId, files) {
    if (files.length === 0) return [];
    if (!dbPromise) return [];
    const db = await dbPromise;
    const base64Files = await Promise.all(Array.from(files).map(fileToBase64));
    
    const existing = await db.get('attachments', passengerId) || [];
    const updatedAttachments = [...existing, ...base64Files];
    await db.put('attachments', updatedAttachments, passengerId);
    return updatedAttachments;
}

async function handlePassengerSubmit(e) {
    e.preventDefault();
    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
    
    const pId = document.getElementById('file-number-display').innerText;
    const fileInput = document.getElementById('attachments');
    
    const attachmentNames = [];
    const attachmentsFullData = [];
    if (fileInput.files.length > 0) {
        try {
            const savedFiles = await saveAttachmentsToDB(pId, fileInput.files);
            savedFiles.forEach(f => {
                attachmentNames.push(f.name);
                attachmentsFullData.push({
                    name: f.name,
                    type: f.type,
                    base64: f.data.split(',')[1]
                });
            });
        } catch(err) {
            console.error('Error saving attachments', err);
        }
    }

    const passenger = {
        id: pId,
        name: document.getElementById('full-name').value,
        phone: document.getElementById('phone').value,
        passport: document.getElementById('passport').value,
        nationality: document.getElementById('nationality').value,
        destination: document.getElementById('destination').value,
        travelDate: document.getElementById('travel-date').value,
        returnDate: document.getElementById('return-date').value,
        tripName: document.getElementById('trip-name').value,
        listName: document.getElementById('list-name').value,
        notes: document.getElementById('notes').value,
        attachments: attachmentNames,
        archivedTrips: [] // For keeping record when moved
    };

    STATE.passengers.push(passenger);
    saveData();
    populateAutocomplete();
    
    sendToGoogleSheets({ type: 'passenger', data: passenger, files: attachmentsFullData });

    Swal.fire({
        title: 'تم الحفظ!',
        text: 'تمت إضافة بيانات المسافر بنجاح',
        icon: 'success',
        confirmButtonText: 'حسناً'
    });

    // Reset fields except Trip and List to speed up bulk entry
    document.getElementById('full-name').value = '';
    document.getElementById('phone').value = '';
    document.getElementById('passport').value = '';
    document.getElementById('notes').value = '';
    fileInput.value = '';
    updateNewFileNumbers();
}

function populateAutocomplete() {
    const trips = new Set();
    const lists = new Set();

    STATE.passengers.forEach(p => {
        if (p.tripName) trips.add(p.tripName);
        if (p.listName) lists.add(p.listName);
    });

    const tripDatalist = document.getElementById('trip-options');
    const listDatalist = document.getElementById('list-options');
    
    tripDatalist.innerHTML = '';
    listDatalist.innerHTML = '';

    trips.forEach(t => tripDatalist.innerHTML += `<option value="${t}">`);
    lists.forEach(l => listDatalist.innerHTML += `<option value="${l}">`);

    // Populate Filters
    const filterTrip = document.getElementById('filter-trip');
    const filterList = document.getElementById('filter-list');
    
    filterTrip.innerHTML = '<option value="">الكل</option>';
    filterList.innerHTML = '<option value="">الكل</option>';
    
    trips.forEach(t => filterTrip.innerHTML += `<option value="${t}">${t}</option>`);
    lists.forEach(l => filterList.innerHTML += `<option value="${l}">${l}</option>`);
}

// --- LISTS & TABLES --- //
function initFilters() {
    document.getElementById('search-passenger').addEventListener('input', renderLists);
    document.getElementById('filter-trip').addEventListener('change', renderLists);
    document.getElementById('filter-list').addEventListener('change', renderLists);
}

function groupPassengers() {
    const grouped = {};
    const search = document.getElementById('search-passenger').value.toLowerCase();
    const filterTrip = document.getElementById('filter-trip').value;
    const filterList = document.getElementById('filter-list').value;

    STATE.passengers.forEach(p => {
        // Filters
        if (search && !p.name.toLowerCase().includes(search)) return;
        if (filterTrip && p.tripName !== filterTrip) return;
        if (filterList && p.listName !== filterList) return;

        if (!grouped[p.tripName]) {
            grouped[p.tripName] = {};
        }
        if (!grouped[p.tripName][p.listName]) {
            grouped[p.tripName][p.listName] = [];
        }
        grouped[p.tripName][p.listName].push(p);
    });

    return grouped;
}

function renderLists() {
    const container = document.getElementById('tables-container');
    container.innerHTML = '';

    const grouped = groupPassengers();
    const trips = Object.keys(grouped).reverse();

    if (trips.length === 0) {
        container.innerHTML = '<div class="glass-card text-center"><p>لا توجد بيانات مطابقة...</p></div>';
        return;
    }

    trips.forEach(tripName => {
        let listsHtml = '';
        const lists = grouped[tripName];
        
        Object.keys(lists).forEach(listName => {
            const passengers = lists[listName];
            listsHtml += `
                <div class="trip-list-container" style="border-right: 4px solid var(--primary-color); padding: 1rem; margin-bottom: 1.5rem; background: var(--glass-bg);">
                    <div class="trip-list-header" style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <h4 style="margin:0; color:var(--text-color);"><i class="fas fa-users"></i> القائمة: <span>${listName}</span></h4>
                            <p style="margin:5px 0 0 0; font-size:0.9rem;">عدد المسافرين: <span class="badge">${passengers.length}</span></p>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button class="btn btn-sm" onclick="openBulkWhatsAppModal('${tripName.replace(/'/g, "\\'")}', '${listName.replace(/'/g, "\\'")}')" style="font-size: 0.85rem; padding: 5px 12px; display:flex; align-items:center; gap:5px; background-color: #25D366; color: white;">
                                <i class="fab fa-whatsapp"></i> رسالة جماعية
                            </button>
                            <button class="btn btn-sm btn-success" onclick="exportListToExcel('${tripName.replace(/'/g, "\\'")}', '${listName.replace(/'/g, "\\'")}')" title="تصدير هذه القائمة" style="font-size: 0.85rem; padding: 5px 12px; display:flex; align-items:center; gap:5px;">
                                <i class="fas fa-file-excel"></i> تصدير إكسيل
                            </button>
                        </div>
                    </div>
                    <div class="table-responsive">
                        <table class="data-table" style="font-size: 0.95rem;">
                            <thead>
                                <tr>
                                    <th>رقم الملف</th>
                                    <th>الاسم</th>
                                    <th>الهاتف</th>
                                    <th>الجواز</th>
                                    <th>تاريخ السفر</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${passengers.map(p => `
                                    <tr>
                                        <td>${p.id}</td>
                                        <td>
                                            ${p.name}
                                            ${p.archivedTrips && p.archivedTrips.length > 0 ? 
                                                `<br><small class="text-muted"><i class="fas fa-history"></i> نُقل من رحلة سابقة</small>` : ''}
                                        </td>
                                        <td>${p.phone}</td>
                                        <td>${p.passport}</td>
                                        <td>${p.travelDate}</td>
                                        <td class="action-buttons">
                                            <button class="btn btn-icon" style="background-color: #25D366; color: white;" onclick="openWhatsApp('${p.phone}')" title="مراسلة واتساب"><i class="fab fa-whatsapp"></i></button>
                                            <button class="btn btn-icon btn-secondary" onclick="openAttModal('${p.id}')" title="عرض المرفقات"><i class="fas fa-paperclip"></i></button>
                                            <button class="btn btn-icon btn-success" onclick="openEditModal('${p.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                                            <button class="btn btn-icon btn-primary" onclick="openMoveModal('${p.id}')" title="نقل المسافر"><i class="fas fa-exchange-alt"></i></button>
                                            <button class="btn btn-icon btn-danger" onclick="deletePassenger('${p.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        });

        const tripHtml = `
            <div class="glass-card" style="margin-bottom: 3rem; background: rgba(13, 110, 253, 0.03); border: 1px solid var(--primary-color);">
                <div style="display:flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--primary-color); padding-bottom: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 10px;">
                    <h2 style="color: var(--primary-color); margin: 0; font-size:1.8rem;"><i class="fas fa-plane-departure"></i> الرحلة: ${tripName}</h2>
                    <div style="display:flex; gap:10px;">
                        <button class="btn btn-sm" onclick="openBulkWhatsAppModal('${tripName.replace(/'/g, "\\'")}')" style="font-weight:bold; background-color:#25D366; color:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                            <i class="fab fa-whatsapp"></i> رسالة جماعية (كل الرحلة)
                        </button>
                        <button class="btn btn-sm btn-warning" onclick="exportTripFinancialStatus('${tripName.replace(/'/g, "\\'")}')" style="font-weight:bold; color:#000; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
                            <i class="fas fa-file-invoice-dollar"></i> كشف متابعة الدفع (Excel)
                        </button>
                    </div>
                </div>
                ${listsHtml}
            </div>
        `;
        container.innerHTML += tripHtml;
    });
}

// --- PASSENGER ACTIONS --- //
function deletePassenger(id) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد أنك تريد حذف هذا المسافر؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    }).then(async (result) => {
        if (result.isConfirmed) {
            STATE.passengers = STATE.passengers.filter(p => p.id !== id);
            saveData();
            if (dbPromise) {
                const db = await dbPromise;
                await db.delete('attachments', id);
            }
            sendToGoogleSheets({ type: 'passenger', action: 'delete', id: id });
            renderLists();
            populateAutocomplete();
        }
    });
}

function openMoveModal(id) {
    const passenger = STATE.passengers.find(p => p.id === id);
    if (!passenger) return;

    document.getElementById('move-p-name').innerText = passenger.name;
    document.getElementById('move-p-id').value = id;
    document.getElementById('move-trip-name').value = '';
    document.getElementById('move-list-name').value = '';
    
    document.getElementById('move-modal').classList.add('show');
}

function closeModal() {
    document.getElementById('move-modal').classList.remove('show');
}

function confirmMovePassenger() {
    const id = document.getElementById('move-p-id').value;
    const newTrip = document.getElementById('move-trip-name').value;
    const newList = document.getElementById('move-list-name').value;

    if (!newTrip || !newList) {
        Swal.fire('خطأ', 'يرجى إدخال اسم الرحلة والقائمة الجديدة', 'error');
        return;
    }

    const index = STATE.passengers.findIndex(p => p.id === id);
    if (index !== -1) {
        const p = STATE.passengers[index];
        // Archive current location
        if (!p.archivedTrips) p.archivedTrips = [];
        p.archivedTrips.push({ trip: p.tripName, list: p.listName, date: new Date().toISOString() });
        
        // Move
        p.tripName = newTrip;
        p.listName = newList;

        saveData();
        sendToGoogleSheets({ type: 'passenger', action: 'edit', data: p });
        closeModal();
        renderLists();
        populateAutocomplete();
        Swal.fire('تم النقل', 'تم نقل المسافر بنجاح مع الاحتفاظ بالسجل', 'success');
    }
}

window.openWhatsApp = function(phone) {
    if (!phone) {
        Swal.fire('خطأ', 'لا يوجد رقم هاتف مسجل لهذا المسافر', 'error');
        return;
    }
    // Clean phone number (remove spaces, dashes, parentheses)
    let cleaned = phone.replace(/[\s\-\(\)]/g, '');
    // Remove 00 or + if present at exactly the start to prep for wa.me format
    if (cleaned.startsWith('00')) {
        cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    const message = "تم استلام تسجيلكم بنجاح ✅\nشكراً لاختياركم قافلة السبطين، ونتمنى لكم رحلة سعيدة 🌿";
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`, '_blank');
};

// --- EDIT PASSENGER --- //
async function openEditModal(id) {
    const passenger = STATE.passengers.find(p => p.id === id);
    if (!passenger) return;

    document.getElementById('edit-p-id').value = passenger.id;
    document.getElementById('edit-name').value = passenger.name;
    document.getElementById('edit-phone').value = passenger.phone;
    document.getElementById('edit-passport').value = passenger.passport;
    document.getElementById('edit-nationality').value = passenger.nationality;
    document.getElementById('edit-destination').value = passenger.destination;
    document.getElementById('edit-travel-date').value = passenger.travelDate;
    document.getElementById('edit-return-date').value = passenger.returnDate;
    document.getElementById('edit-trip-name').value = passenger.tripName;
    document.getElementById('edit-list-name').value = passenger.listName;
    document.getElementById('edit-notes').value = passenger.notes || '';
    
    // Clear new attachments input
    document.getElementById('edit-attachments').value = '';

    const previewContainer = document.getElementById('edit-attachment-preview');
    previewContainer.innerHTML = '<i>جاري تحميل المرفقات...</i>';
    
    let attachments = [];
    if (dbPromise) {
        const db = await dbPromise;
        attachments = await db.get('attachments', passenger.id) || [];
    }
    
    previewContainer.innerHTML = attachments.length === 0 ? '<small>لا توجد مرفقات سابقة</small>' : '';
    attachments.forEach((att, index) => {
        const isImage = att.type.startsWith('image/');
        const previewEl = document.createElement('div');
        previewEl.style.cssText = "border:1px solid var(--border-color); padding:5px; border-radius:5px; text-align:center; position:relative; background:var(--light-bg);";
        
        previewEl.innerHTML = `
            ${isImage ? `<img src="${att.data}" style="height:60px; max-width:80px; object-fit:cover; display:block; margin:auto">` : `<i class="fas fa-file-pdf" style="font-size:40px; color:var(--danger-color)"></i>`}
            <div style="font-size:10px; margin-top:5px; max-width:80px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${att.name}">${att.name}</div>
            <button type="button" onclick="deleteAttachment('${passenger.id}', ${index})" style="position:absolute; top:-5px; right:-5px; background:var(--danger-color); color:white; border:none; border-radius:50%; width:20px; height:20px; cursor:pointer;" title="حذف">&times;</button>
        `;
        previewContainer.appendChild(previewEl);
    });

    document.getElementById('edit-modal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.remove('show');
    document.getElementById('edit-passenger-form').reset();
    document.getElementById('edit-attachment-preview').innerHTML = '';
}

async function handleEditSubmit(e) {
    e.preventDefault();
    Swal.fire({ title: 'جاري الحفظ...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});

    const id = document.getElementById('edit-p-id').value;
    const index = STATE.passengers.findIndex(p => p.id === id);
    if (index === -1) return;

    const fileInput = document.getElementById('edit-attachments');
    let updatedAttachmentNames = [...(STATE.passengers[index].attachments || [])];
    const attachmentsFullData = [];
    
    if (fileInput.files.length > 0) {
        try {
            const newlySaved = await saveAttachmentsToDB(id, fileInput.files);
            updatedAttachmentNames = newlySaved.map(f => f.name);
            
            const base64Files = await Promise.all(Array.from(fileInput.files).map(fileToBase64));
            base64Files.forEach(f => {
                attachmentsFullData.push({
                    name: f.name, type: f.type, base64: f.data.split(',')[1]
                });
            });
        } catch(err) {
            console.error(err);
        }
    }

    STATE.passengers[index] = {
        ...STATE.passengers[index],
        name: document.getElementById('edit-name').value,
        phone: document.getElementById('edit-phone').value,
        passport: document.getElementById('edit-passport').value,
        nationality: document.getElementById('edit-nationality').value,
        destination: document.getElementById('edit-destination').value,
        travelDate: document.getElementById('edit-travel-date').value,
        returnDate: document.getElementById('edit-return-date').value,
        tripName: document.getElementById('edit-trip-name').value,
        listName: document.getElementById('edit-list-name').value,
        notes: document.getElementById('edit-notes').value,
        attachments: updatedAttachmentNames
    };

    saveData();
    sendToGoogleSheets({ type: 'passenger', action: 'edit', data: STATE.passengers[index], files: attachmentsFullData });
    populateAutocomplete();
    renderLists();
    closeEditModal();
    
    Swal.fire('تم التعديل', 'تم حفظ التعديلات بنجاح', 'success');
}

window.deleteAttachment = async function(pId, index) {
    if (!confirm('هل أنت متأكد من حذف هذا المرفق؟')) return;
    if (dbPromise) {
        const db = await dbPromise;
        let attachments = await db.get('attachments', pId) || [];
        attachments.splice(index, 1);
        await db.put('attachments', attachments, pId);
        
        const pIndex = STATE.passengers.findIndex(p => p.id === pId);
        if(pIndex !== -1){
            STATE.passengers[pIndex].attachments = attachments.map(f => f.name);
            saveData();
        }
        openEditModal(pId); // refresh
    }
}

// --- VIEW & DOWNLOAD ATTACHMENTS --- //
async function openAttModal(id) {
    const passenger = STATE.passengers.find(p => p.id === id);
    if (!passenger) return;

    document.getElementById('view-att-p-name').innerText = passenger.name;
    const container = document.getElementById('attachments-list-container');
    container.innerHTML = '<i>جاري التحميل...</i>';

    let attachments = [];
    if (dbPromise) {
        const db = await dbPromise;
        attachments = await db.get('attachments', passenger.id) || [];
    }
    
    container.innerHTML = attachments.length === 0 ? '<p style="margin-top:20px;">لا توجد مرفقات مسجلة لهذا المسافر.</p>' : '';
    
    attachments.forEach((att) => {
        const isImage = att.type.startsWith('image/');
        const el = document.createElement('div');
        el.style.cssText = "border:1px solid var(--border-color); padding:10px; border-radius:8px; text-align:center; background:var(--light-bg); width: 180px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px;";
        
        // Use download attribute correctly
        el.innerHTML = `
            <div style="height:120px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                ${isImage ? `<img src="${att.data}" style="max-height:120px; max-width:100%; object-fit:contain; border-radius:4px;">` : `<i class="fas fa-file-pdf" style="font-size:60px; color:var(--danger-color)"></i>`}
            </div>
            <div style="font-size:12px; font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${att.name}">${att.name}</div>
            <a href="${att.data}" download="${att.name}" class="btn btn-primary" style="font-size:12px; padding:8px; text-decoration:none;"><i class="fas fa-download"></i> تنزيل / مشاهدة</a>
        `;
        container.appendChild(el);
    });

    document.getElementById('attachments-modal').classList.add('show');
}

function closeAttModal() {
    document.getElementById('attachments-modal').classList.remove('show');
    document.getElementById('attachments-list-container').innerHTML = '';
}

// --- EXPORT TO EXCEL --- //
function exportAllToExcel() {
    if (STATE.passengers.length === 0) {
        Swal.fire('لا توجد بيانات', 'لا يوجد مسافرون للتصدير', 'info');
        return;
    }

    const grouped = {};
    STATE.passengers.forEach(p => {
        const sheetName = `${p.tripName.substring(0, 15)} - ${p.listName.substring(0, 15)}`.replace(/[*/:?\]\[\\]/g, ""); // Excel sheet name limits
        if (!grouped[sheetName]) grouped[sheetName] = [];
        grouped[sheetName].push({
            'رقم الملف': p.id,
            'اسم المسافر': p.name,
            'رقم الهاتف': p.phone,
            'الجواز': p.passport,
            'الجنسية': p.nationality,
            'الوجهة': p.destination,
            'تاريخ السفر': p.travelDate,
            'تاريخ العودة': p.returnDate,
            'الرحلة': p.tripName,
            'القائمة': p.listName,
            'الملاحظات': p.notes
        });
    });

    const wb = XLSX.utils.book_new();

    Object.keys(grouped).forEach(sheetName => {
        const ws = XLSX.utils.json_to_sheet(grouped[sheetName]);
        // Support RTL in Excel if possible, otherwise standard is fine.
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `بيانات_المسافرين_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.xlsx`);
}

function exportListToExcel(tripName, listName) {
    const listPassengers = STATE.passengers.filter(p => p.tripName === tripName && p.listName === listName);
    if (listPassengers.length === 0) return;

    const data = listPassengers.map(p => ({
        'رقم الملف': p.id,
        'اسم المسافر': p.name,
        'رقم الهاتف': p.phone,
        'الجواز': p.passport,
        'الجنسية': p.nationality,
        'الوجهة': p.destination,
        'تاريخ السفر': p.travelDate,
        'تاريخ العودة': p.returnDate,
        'الرحلة': p.tripName,
        'القائمة': p.listName,
        'الملاحظات': p.notes
    }));

    const sheetName = `${tripName.substring(0, 10)}_${listName.substring(0, 10)}`.replace(/[*/:?\]\[\\]/g, "");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName || "List");

    XLSX.writeFile(wb, `تصدير_${sheetName}_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.xlsx`);
}

function exportTripFinancialStatus(tripName) {
    const tripPassengers = STATE.passengers.filter(p => p.tripName === tripName);
    if (tripPassengers.length === 0) {
        Swal.fire('خطأ', 'لا يوجد مسافرون في هذه الرحلة لتصدير الكشف', 'error');
        return;
    }

    const data = tripPassengers.map(passenger => {
        // Find matching payments for this passenger in this trip
        const passengerPayments = STATE.payments.filter(pay => {
            return (pay.phone === passenger.phone || pay.name === passenger.name) && pay.tripName === tripName;
        });
        
        let totalPaid = 0;
        let lastKnownTotal = 0; // Total required amount (from the latest receipt)
        
        passengerPayments.forEach(pay => {
            totalPaid += parseFloat(pay.paid) || 0;
            if (parseFloat(pay.total) > 0) {
                lastKnownTotal = parseFloat(pay.total);
            }
        });
        
        let remaining = lastKnownTotal > 0 ? (lastKnownTotal - totalPaid) : 0;
        if (remaining < 0) remaining = 0; // Overpaid edge case
        
        // Define Status
        let status = "لم يتم الدفع";
        if (passengerPayments.length > 0) {
            if (remaining === 0 && lastKnownTotal > 0) status = "✅ مكتمل الدفع";
            else if (totalPaid > 0) status = "⚠️ دفع جزئي";
        }

        return {
            'رقم الملف': passenger.id,
            'اسم المسافر': passenger.name,
            'رقم الهاتف': passenger.phone,
            'القائمة (المجموعة)': passenger.listName,
            'حالة الدفع': status,
            'المبلغ الكلي للرحلة': lastKnownTotal > 0 ? lastKnownTotal : 'غير محدد',
            'إجمالي المدفوع': totalPaid,
            'المبلغ المتبقي': lastKnownTotal > 0 ? remaining : 'غير محدد'
        };
    });

    const sheetName = tripName.substring(0, 25).replace(/[*/:?\]\[\\]/g, "");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "كشف الدفع");

    XLSX.writeFile(wb, `كشف_دفع_${sheetName}_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.xlsx`);
}

// --- PAYMENTS & RECEIPTS --- //
function populatePaymentPassengers() {
    const select = document.getElementById('pay-passenger-select');
    select.innerHTML = '<option value="">-- اختر مسافراً (اختياري لسحب البيانات) --</option>';
    
    STATE.passengers.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.name} - ${p.tripName}</option>`;
    });
}

function handlePassengerSelectForPayment() {
    const id = document.getElementById('pay-passenger-select').value;
    if (id) {
        const p = STATE.passengers.find(x => x.id === id);
        if (p) {
            document.getElementById('pay-name').value = p.name;
            document.getElementById('pay-phone').value = p.phone;
            document.getElementById('pay-trip-name').value = p.tripName || '';
            document.getElementById('pay-description').value = `دفعة لرحلة: ${p.tripName} (${p.listName})`;
        }
    }
}

function calculateRemaining() {
    const total = parseFloat(document.getElementById('pay-total').value) || 0;
    const paid = parseFloat(document.getElementById('pay-paid').value) || 0;
    const remaining = total - paid;
    document.getElementById('pay-remaining').value = remaining.toFixed(2);
}

function handlePaymentSubmit(e) {
    e.preventDefault();

    let signatureData = null;
    if (typeof sigEmpty !== 'undefined' && !sigEmpty && sigCanvas) {
        signatureData = sigCanvas.toDataURL('image/png');
    }

    const payment = {
        id: document.getElementById('receipt-number-display').innerText,
        name: document.getElementById('pay-name').value,
        phone: document.getElementById('pay-phone').value,
        tripName: document.getElementById('pay-trip-name').value,
        date: document.getElementById('pay-date').value,
        currency: document.getElementById('pay-currency').value,
        method: document.getElementById('pay-method').value,
        description: document.getElementById('pay-description').value,
        total: parseFloat(document.getElementById('pay-total').value).toFixed(2),
        paid: parseFloat(document.getElementById('pay-paid').value).toFixed(2),
        remaining: parseFloat(document.getElementById('pay-remaining').value).toFixed(2),
        signature: signatureData
    };

    STATE.payments.push(payment);
    saveData();
    renderReceipts();
    generateReceiptView(payment);
    
    sendToGoogleSheets({ type: 'payment', data: payment });

    Swal.fire('تم الإنشاء', 'تم حفظ بيانات الدفع وإصدار الرصيد', 'success');
    document.getElementById('payment-form').reset();
    if (typeof sigCanvas !== 'undefined' && sigCanvas) {
        document.getElementById('btn-clear-signature').click();
    }
    updateNewFileNumbers();
    
    // Show preview container
    document.getElementById('receipt-preview-container').classList.remove('hidden');
}

function generateReceiptView(payment) {
    const paper = document.getElementById('receipt-paper');
    const curMap = { 'د.ب': 'BHD', 'ر.س': 'SAR', '$': 'USD' };
    const cc = curMap[payment.currency] || payment.currency;

    paper.innerHTML = `
        <div style="background:#fff; font-family:'Cairo', sans-serif; color:#333; width: 100%;">
            <!-- Header -->
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${typeof LOGO_BASE64 !== 'undefined' ? LOGO_BASE64 : 'logo.png'}" alt="شعار السبطين" style="max-height: 110px; width: auto; object-fit: contain; margin-bottom: 5px;">
                <div style="margin-top: 10px; color: #1b1f3b; font-size: 22px; font-weight: 900;">وصل استلام</div>
                <div style="color: #777; font-size: 12px; font-weight: 500;">Receipt Voucher</div>
            </div>
            
            <!-- Orange Divider -->
            <div style="height: 2px; background-color: #d95c14; margin-bottom: 20px; width: 100%;"></div>
            
            <!-- Details Grid -->
            <div style="display: flex; flex-direction: column; gap: 12px; text-align: right;">
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #eaeaea; padding-bottom: 8px;">
                    <span style="color: #666; font-size: 14px;">رقم الإيصال / Receipt No.</span>
                    <strong style="font-size: 15px; color: #333;" dir="ltr">${payment.id}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #eaeaea; padding-bottom: 8px;">
                    <span style="color: #666; font-size: 14px;">التاريخ / Date</span>
                    <strong style="font-size: 15px; color: #333;" dir="ltr">${payment.date}</strong>
                </div>
                
                <div style="border-bottom: 1px dashed #eaeaea; padding-bottom: 8px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 4px;">استلمنا من السيد/السيدة / Received From</div>
                    <div style="font-size: 17px; font-weight: 700; color: #333;">${payment.name}</div>
                </div>
                
                <div style="border-bottom: 1px dashed #eaeaea; padding-bottom: 8px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 4px;">المقابل / Being For</div>
                    <div style="font-size: 16px; font-weight: 700; color: #333;">${payment.description}</div>
                </div>

                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #eaeaea; padding-bottom: 8px;">
                    <span style="color: #666; font-size: 14px;">طريقة الدفع / Method</span>
                    <strong style="font-size: 15px; color: #333;">${payment.method}</strong>
                </div>

                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #eaeaea; padding-bottom: 8px; background-color: #f9f9f9; padding: 10px; border-radius: 4px; margin-top: 5px;">
                    <span style="color: #333; font-size: 15px; font-weight: 600;">المبلغ المستلم / Received</span>
                    <strong style="font-size: 18px; color: #1b1f3b;" dir="ltr">${cc} ${payment.paid}</strong>
                </div>
                
                <div style="display: flex; justify-content: space-between; padding: 10px; border-radius: 4px;">
                    <span style="color: #666; font-size: 14px;">المبلغ المتبقي / Remaining</span>
                    <strong style="font-size: 16px; color: #d95c14;" dir="ltr">${cc} ${payment.remaining}</strong>
                </div>
            </div>
            
            <!-- Signatures and Stamps -->
            <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; gap: 10px; padding: 0 10px;">
                
                <!-- Electronic Signature -->
                <div style="text-align: center; flex: 1; position: relative;">
                    <div style="height: 100px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
                        ${payment.signature ? `<img src="${payment.signature}" style="max-height: 140px; max-width: 200px; object-fit: contain; transform: scale(1.15); transform-origin: bottom center;" alt="توقيع">` : ''}
                    </div>
                    <div style="border-top: 1px dashed #ccc; padding-top: 5px; font-size: 13px; font-weight: 700; color: #555;">توقيع المستلم</div>
                </div>

                <!-- Spacer -->
                <div style="width: 20px;"></div>

                <!-- Stamp Image -->
                <div style="flex: 1; text-align: center;">
                    <img src="${typeof STAMP_BASE64 !== 'undefined' ? STAMP_BASE64 : 'stamp.png'}" style="width: 120px; height: 120px; object-fit: contain; transform: rotate(-5deg); opacity: 0.95;" alt="ختم السبطين">
                </div>

            </div>
            
            <!-- Footer Details -->
            <div style="margin-top: 20px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                <div style="text-align: center; color: #d95c14; font-size: 12px; font-weight: 600; direction: ltr;">
                    <div><i class="fab fa-instagram"></i> qafialt_alsebtain | <i class="fab fa-whatsapp"></i> +973 33 4 111 31</div>
                </div>
                
                <div style="color: #bbb; font-size: 11px;">
                    Generated by Al-Sebtain System
                </div>
            </div>
        </div>
    `;

    // Setup Print & PDF Buttons
    document.getElementById('btn-print-receipt').onclick = () => {
        window.print();
    };

    document.getElementById('btn-pdf-receipt').onclick = () => {
        generatePDF(paper, payment.id);
    };

    document.getElementById('btn-wa-receipt').onclick = async () => {
        if (!payment.phone) {
            Swal.fire('تنبيه', 'لا يوجد رقم هاتف مسجل لهذا الرصيد', 'warning');
            return;
        }
        
        try {
            Swal.fire({ title: 'جاري تجهيز ملف الـ PDF للصقل والمشاركة...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
            
            // Build the PDF blob behind the scenes
            const canvas = await html2canvas(paper, { scale: 2, useCORS: true, allowTaint: true });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdfWidth = paper.offsetWidth;
            const pdfHeight = paper.offsetHeight;
            const pdf = new jsPDF({
                orientation: 'p',
                unit: 'px',
                format: [pdfWidth, pdfHeight]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            
            const pdfBlob = pdf.output('blob');
            
            Swal.close();
            
            Swal.fire({
                title: 'جاهز للإرسال',
                text: 'الواتساب لا يسمح حالياً بإرفاق ملفات PDF بشكل آلي عبر الروابط. لكن لا تقلق!\n\nسيتم تنزيل الملف الآن. المحادثة مع المسافر ستُفتح في نافذة جديدة، فقط قم بسحب الملف الساقط بالأسفل وإفلاته في المحادثة!',
                icon: 'success',
                confirmButtonText: 'تنزيل وفتح الواتساب'
            }).then(() => {
                // Download it automatically
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `وصل_استلام_${payment.id}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
                
                // Clean phone and open WhatsApp chat directly for THIS passenger
                let cleaned = payment.phone.replace(/[\s\-\(\)]/g, '');
                if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
                else if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
                
                window.open(`https://wa.me/${cleaned}`, '_blank');
            });

        } catch (error) {
            console.error('Sharing error:', error);
            Swal.close();
        }
    };
}

function renderReceipts() {
    const container = document.getElementById('receipts-container');
    container.innerHTML = '';
    
    const reversed = [...STATE.payments].reverse();
    const grouped = {};
    
    reversed.forEach(p => {
        const tName = p.tripName || 'أرصدة عامة (غير محددة بمسافر/رحلة)';
        if (!grouped[tName]) grouped[tName] = [];
        grouped[tName].push(p);
    });

    const trips = Object.keys(grouped);

    if (trips.length === 0) {
        container.innerHTML = '<div class="glass-card text-center"><p>لا توجد أرصدة بعد...</p></div>';
        return;
    }

    trips.forEach(tripName => {
        const paymentsList = grouped[tripName];
        let rowsHtml = '';
        
        paymentsList.forEach(p => {
            rowsHtml += `
                <tr>
                    <td>${p.id}</td>
                    <td>${p.date}</td>
                    <td>${p.name}</td>
                    <td>${p.description}</td>
                    <td><span class="badge" style="background-color:var(--secondary-color)">${p.method}</span></td>
                    <td style="color:var(--success-color); font-weight:bold;">${p.paid} ${p.currency}</td>
                    <td style="color:var(--danger-color); font-weight:bold;">${p.remaining} ${p.currency}</td>
                    <td class="action-buttons">
                        <button class="btn btn-icon btn-success" onclick="openEditReceiptModal('${p.id}')" title="تعديل"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-icon btn-primary" onclick="viewReceipt('${p.id}')" title="معاينة"><i class="fas fa-eye"></i></button>
                        <button class="btn btn-icon btn-danger" onclick="deleteReceipt('${p.id}')" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        });

        const html = `
            <div class="glass-card trip-group" style="margin-bottom: 2.5rem; border: 1px solid rgba(var(--secondary-color), 0.3);">
                <div style="display:flex; justify-content: space-between; align-items:flex-start; margin-bottom: 1rem; border-bottom: 2px solid var(--secondary-color); padding-bottom: 1rem;">
                    <div>
                        <h3 style="margin:0; color:var(--secondary-color); font-size: 1.5rem;"><i class="fas fa-plane"></i> رحلة: ${tripName}</h3>
                        <p style="margin:5px 0 0 0; font-size:1rem;">إجمالي الأرصدة: <span class="badge" style="background-color: var(--secondary-color);">${paymentsList.length}</span></p>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-success" onclick="exportTripPaymentsToExcel('${tripName.replace(/'/g, "\\'")}')" title="تصدير أرصدة هذه الرحلة" style="padding: 6px 15px; display:flex; align-items:center; gap:5px;">
                            <i class="fas fa-file-excel"></i> تصدير إكسيل
                        </button>
                    </div>
                </div>
                
                <div class="table-responsive">
                    <table class="data-table" style="font-size: 0.95rem;">
                        <thead>
                            <tr>
                                <th>رقم الرصيد</th>
                                <th>التاريخ</th>
                                <th>المسافر</th>
                                <th>الوصف</th>
                                <th>طريقة الدفع</th>
                                <th>المدفوع</th>
                                <th>المتبقي</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

function viewReceipt(id) {
    const p = STATE.payments.find(x => x.id === id);
    if(p) {
        generateReceiptView(p);
        document.getElementById('receipt-preview-container').classList.remove('hidden');
        window.scrollTo({ top: document.getElementById('receipt-preview-container').offsetTop, behavior: 'smooth' });
    }
}

function deleteReceipt(id) {
    Swal.fire({
        title: 'حذف الرصيد',
        text: 'هل أنت متأكد من الحذف؟',
        icon: 'warning',
        showCancelButton: true
    }).then((result) => {
        if (result.isConfirmed) {
            STATE.payments = STATE.payments.filter(p => p.id !== id);
            saveData();
            sendToGoogleSheets({ type: 'payment', action: 'delete', id: id });
            renderReceipts();
            document.getElementById('receipt-preview-container').classList.add('hidden');
        }
    });
}

function exportPaymentsToExcel() {
    if (STATE.payments.length === 0) {
        Swal.fire('لا توجد بيانات', 'لا يوجد أرصدة للتصدير', 'info');
        return;
    }

    const grouped = {};
    STATE.payments.forEach(p => {
        const sheetName = (p.tripName || 'أخرى').substring(0, 25).replace(/[*/:?\]\[\\]/g, "");
        if (!grouped[sheetName]) grouped[sheetName] = [];
        grouped[sheetName].push({
            'رقم الرصيد': p.id,
            'التاريخ': p.date,
            'اسم المسافر': p.name,
            'رقم الهاتف': p.phone,
            'الوصف': p.description,
            'طريقة الدفع': p.method,
            'العملة': p.currency,
            'المبلغ الكلي': p.total,
            'المدفوع': p.paid,
            'المتبقي': p.remaining
        });
    });

    const wb = XLSX.utils.book_new();

    Object.keys(grouped).forEach(sheetName => {
        const ws = XLSX.utils.json_to_sheet(grouped[sheetName]);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    XLSX.writeFile(wb, `تقرير_مالي_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.xlsx`);
}

function exportTripPaymentsToExcel(tripName) {
    const list = STATE.payments.filter(p => (p.tripName || 'أرصدة عامة (غير محددة بمسافر/رحلة)') === tripName);
    if (list.length === 0) return;

    const data = list.map(p => ({
        'رقم الرصيد': p.id,
        'التاريخ': p.date,
        'اسم المسافر': p.name,
        'رقم الهاتف': p.phone,
        'الرحلة': p.tripName || 'غير محدد',
        'الوصف': p.description,
        'طريقة الدفع': p.method,
        'العملة': p.currency,
        'المبلغ الكلي': parseFloat(p.total) || 0,
        'المدفوع': parseFloat(p.paid) || 0,
        'المتبقي': parseFloat(p.remaining) || 0
    }));

    // Add totals row
    const totalPaid = data.reduce((sum, item) => sum + item['المدفوع'], 0);
    const totalRemaining = data.reduce((sum, item) => sum + item['المتبقي'], 0);
    const totalAmount = data.reduce((sum, item) => sum + item['المبلغ الكلي'], 0);

    data.push({}); // Empty row
    data.push({
        'رقم الرصيد': 'الإجماليات',
        'المبلغ الكلي': totalAmount,
        'المدفوع': totalPaid,
        'المتبقي': totalRemaining
    });

    const sheetName = tripName.substring(0, 25).replace(/[*/:?\]\[\\]/g, "");
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    XLSX.writeFile(wb, `أرصدة_${sheetName}_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.xlsx`);
}

function calculateEditRemaining() {
    const total = parseFloat(document.getElementById('edit-pay-total').value) || 0;
    const paid = parseFloat(document.getElementById('edit-pay-paid').value) || 0;
    const remaining = total - paid;
    document.getElementById('edit-pay-remaining').value = remaining.toFixed(2);
}

function openEditReceiptModal(id) {
    const payment = STATE.payments.find(p => p.id === id);
    if (!payment) return;

    document.getElementById('edit-receipt-id').value = payment.id;
    document.getElementById('edit-pay-name').value = payment.name;
    document.getElementById('edit-pay-phone').value = payment.phone;
    document.getElementById('edit-pay-trip-name').value = payment.tripName || '';
    document.getElementById('edit-pay-date').value = payment.date;
    document.getElementById('edit-pay-currency').value = payment.currency;
    document.getElementById('edit-pay-method').value = payment.method;
    document.getElementById('edit-pay-description').value = payment.description;
    document.getElementById('edit-pay-total').value = payment.total;
    document.getElementById('edit-pay-paid').value = payment.paid;
    document.getElementById('edit-pay-remaining').value = payment.remaining;

    document.getElementById('edit-receipt-modal').classList.add('show');
}

function closeEditReceiptModal() {
    document.getElementById('edit-receipt-modal').classList.remove('show');
}

function handleEditReceiptSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-receipt-id').value;
    const index = STATE.payments.findIndex(p => p.id === id);
    if (index === -1) return;

    STATE.payments[index] = {
        id: id,
        name: document.getElementById('edit-pay-name').value,
        phone: document.getElementById('edit-pay-phone').value,
        tripName: document.getElementById('edit-pay-trip-name').value,
        date: document.getElementById('edit-pay-date').value,
        currency: document.getElementById('edit-pay-currency').value,
        method: document.getElementById('edit-pay-method').value,
        description: document.getElementById('edit-pay-description').value,
        total: parseFloat(document.getElementById('edit-pay-total').value).toFixed(2),
        paid: parseFloat(document.getElementById('edit-pay-paid').value).toFixed(2),
        remaining: parseFloat(document.getElementById('edit-pay-remaining').value).toFixed(2)
    };

    saveData();
    sendToGoogleSheets({ type: 'payment', action: 'edit', data: STATE.payments[index] });
    renderReceipts();
    closeEditReceiptModal();
    
    const paperHtml = document.getElementById('receipt-paper').innerHTML;
    if(paperHtml.includes(id)) {
        generateReceiptView(STATE.payments[index]);
    }

    Swal.fire('تم التعديل', 'تم حفظ التعديلات بنجاح', 'success');
}

// --- PDF GENERATION --- //
async function generatePDF(element, filename) {
    try {
        Swal.fire({ title: 'جاري إنشاء PDF...', allowOutsideClick: false, didOpen: () => Swal.showLoading()});
        
        const canvas = await html2canvas(element, { scale: 2, useCORS: true, allowTaint: true });
        const imgData = canvas.toDataURL('image/png');
        
        const { jsPDF } = window.jspdf;
        const pdfWidth = element.offsetWidth;
        const pdfHeight = element.offsetHeight;
        const pdf = new jsPDF({
            orientation: 'p',
            unit: 'px',
            format: [pdfWidth, pdfHeight]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`رصيد_${filename}.pdf`);
        
        Swal.close();
    } catch(err) {
        console.error(err);
        Swal.fire('خطأ', 'حدث خطأ أثناء إنشاء الملف', 'error');
    }
}

// --- BULK WHATSAPP GENERATION --- //
let currentBulkPassengers = [];

window.openBulkWhatsAppModal = function(tripName, listName = null) {
    if (listName) {
        currentBulkPassengers = STATE.passengers.filter(p => p.tripName === tripName && p.listName === listName);
        document.getElementById('bulk-target-name').innerText = `قائمة [${listName}] من رحلة [${tripName}]`;
    } else {
        currentBulkPassengers = STATE.passengers.filter(p => p.tripName === tripName);
        document.getElementById('bulk-target-name').innerText = `جميع مسافري رحلة [${tripName}]`;
    }

    if (currentBulkPassengers.length === 0) return;

    document.getElementById('bulk-count').innerText = currentBulkPassengers.length;
    
    // Default welcome message format
    document.getElementById('bulk-message').value = "السلام عليكم ورحمة الله وبركاته،\nنود إعلامكم من الدعم الفني في السبطين للسياحة بأنه...";
    
    renderBulkPassengers();
    document.getElementById('bulk-wa-modal').classList.add('show');
};

function renderBulkPassengers() {
    const listContainer = document.getElementById('bulk-passengers-list');
    listContainer.innerHTML = '';
    
    currentBulkPassengers.forEach((p, index) => {
        const row = document.createElement('div');
        row.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(0,0,0,0.02); border: 1px solid #ddd; border-radius: 5px;";
        
        // Show missing phone indicator securely
        let buttonHTML = '';
        if (p.phone && p.phone.trim().length > 4) {
            buttonHTML = `<button class="btn btn-sm" id="btn-wa-bulk-${index}" style="background-color: #25D366; color: white; transition: 0.2s; white-space:nowrap;" onclick="sendSingleBulkWA(${index})">
                    <i class="fab fa-whatsapp"></i> إرسال
                </button>`;
        } else {
            buttonHTML = `<span style="color:var(--danger-color); font-size:0.85rem;"><i class="fas fa-exclamation-triangle"></i> لا رقم هاتف</span>`;
        }

        row.innerHTML = `
            <div style="flex:1;">
                <strong style="color:var(--primary-color)">${p.name}</strong> <br>
                <small dir="ltr" style="color:#555"><i class="fas fa-phone"></i> ${p.phone || 'غير مسجل'}</small>
            </div>
            <div>
                ${buttonHTML}
            </div>
        `;
        listContainer.appendChild(row);
    });
}

window.sendSingleBulkWA = function(index) {
    const p = currentBulkPassengers[index];
    const msg = document.getElementById('bulk-message').value;
    
    if (!p.phone) return;
    
    // Clean phone number (remove spaces, dashes, parentheses)
    let cleaned = p.phone.replace(/[\s\-\(\)]/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    else if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    
    // Advanced personalization placeholder replacement! Let them use {الاسم} if they want.
    let personalMsg = msg.replace(/{الاسم}/g, p.name).replace(/{name}/gi, p.name);
    
    // Change button status dynamically
    const btn = document.getElementById(`btn-wa-bulk-${index}`);
    if (btn) {
        btn.innerHTML = `<i class="fas fa-check"></i> تم التوجيه`;
        btn.style.backgroundColor = 'var(--secondary-color)';
        btn.style.opacity = '0.7';
    }
    
    // Open WA
    window.open(`https://wa.me/${cleaned}?text=${encodeURIComponent(personalMsg)}`, '_blank');
};

function closeBulkWAModal() {
    document.getElementById('bulk-wa-modal').classList.remove('show');
}

// --- BACKUP & RESTORE --- //
async function performBackup() {
    try {
        Swal.fire({
            title: 'جاري حزم البيانات...',
            text: 'يرجى الانتظار، جاري حفظ بيانات المسافرين والأرصدة والمرفقات.',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const backupData = {
            version: "1.0",
            timestamp: new Date().toISOString(),
            passengers: STATE.passengers,
            payments: STATE.payments,
            attachments: {}
        };

        if (dbPromise) {
            const db = await dbPromise;
            const keys = await db.getAllKeys('attachments');
            for (let key of keys) {
                const atts = await db.get('attachments', key);
                backupData.attachments[key] = atts;
            }
        }

        const dataStr = JSON.stringify(backupData);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `نسخة_احتياطية_السبطين_${new Date().toLocaleDateString('en-GB').replace(/\//g,'-')}.json`;
        a.click();

        URL.revokeObjectURL(url);
        
        Swal.fire('نجاح', 'تم تنزيل ملف النسخة الاحتياطية بنجاح! يمكنك إرساله ومشاركته على أجهزتك الأخرى.', 'success');

    } catch (err) {
        console.error('Backup Error:', err);
        Swal.fire('خطأ', 'حدث خطأ أثناء إنشاء النسخة الاحتياطية', 'error');
    }
}

function performRestore(event) {
    const file = event.target.files[0];
    if (!file) return;

    Swal.fire({
        title: 'تحذير استبدال البيانات ⛔',
        text: 'هل أنت متأكد؟ هذه العملية ستقوم بمسح كافة البيانات الحالية الموجودة على المتصفح واستبدالها بالبيانات المرفوعة في الملف!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'نعم، استبدل البيانات الآن',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    Swal.fire({
                        title: 'جاري استعادة البيانات...',
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading()
                    });

                    const parsed = JSON.parse(e.target.result);
                    
                    if (!parsed.passengers || !parsed.payments) {
                        throw new Error('ملف التخزين غير صالح أو تالف.');
                    }

                    // Restore LocalStorage
                    localStorage.setItem('passengers', JSON.stringify(parsed.passengers));
                    localStorage.setItem('payments', JSON.stringify(parsed.payments));

                    // Restore IndexedDB
                    if (dbPromise && parsed.attachments) {
                        const db = await dbPromise;
                        // Clear existing manually
                        await db.clear('attachments');

                        // Insert new data
                        for (let [key, value] of Object.entries(parsed.attachments)) {
                            await db.put('attachments', value, key);
                        }
                    }

                    Swal.fire(
                        'تم الاسترجاع بنجاح!',
                        'تمت استعادة كافة بيانات المسافرين، الأرصدة والمرفقات! سيتم تحديث الصفحة الآن...',
                        'success'
                    ).then(() => {
                        window.location.reload();
                    });

                } catch (err) {
                    console.error('Restore Error:', err);
                    Swal.fire('خطأ', 'حدث خطأ! تأكد من أن الملف هو بالفعل نسخة احتياطية صالحة وغير تالفة.', 'error');
                }
            };
            reader.readAsText(file);
        }
    });

    // Reset file input so they can import the same file again if needed
    event.target.value = '';
}
