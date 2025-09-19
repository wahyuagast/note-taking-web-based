// App State
let isLoggedIn = false;
let currentFolder = 'all';
let currentView = 'grid';
let currentEditingNote = null;
let currentViewingNote = null;
let cropCanvas = null;
let cropContext = null;
let currentImage = null;
let cropSelection = null;

// Data Storage (using localStorage)
const storage = {
    notes: JSON.parse(localStorage.getItem('notes') || '[]'),
    folders: JSON.parse(localStorage.getItem('folders') || '[]'),
    
    saveNotes() {
        localStorage.setItem('notes', JSON.stringify(this.notes));
    },
    
    saveFolders() {
        localStorage.setItem('folders', JSON.stringify(this.folders));
    }
};

// DOM Elements
const loginPage = document.getElementById('loginPage');
const mainApp = document.getElementById('mainApp');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');
const searchInput = document.getElementById('searchInput');
const addFolderBtn = document.getElementById('addFolderBtn');
const addNoteBtn = document.getElementById('addNoteBtn');
const foldersList = document.getElementById('foldersList');
const notesList = document.getElementById('notesList');
const emptyState = document.getElementById('emptyState');
const currentFolderTitle = document.getElementById('currentFolderTitle');
const gridViewBtn = document.getElementById('gridViewBtn');
const listViewBtn = document.getElementById('listViewBtn');

// Modal Elements
const noteViewModal = document.getElementById('noteViewModal');
const noteModal = document.getElementById('noteModal');
const folderModal = document.getElementById('folderModal');
const cropModal = document.getElementById('cropModal');
const noteForm = document.getElementById('noteForm');
const folderForm = document.getElementById('folderForm');
const modalTitle = document.getElementById('modalTitle');

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    setupEventListeners();
    loadFolders();
    loadNotes();
});

// Event Listeners
function setupEventListeners() {
    // Login
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    // Search
    searchInput.addEventListener('input', handleSearch);
    
    // Folders
    addFolderBtn.addEventListener('click', showAddFolderModal);
    folderForm.addEventListener('submit', handleAddFolder);
    
    // Notes
    addNoteBtn.addEventListener('click', showAddNoteModal);
    noteForm.addEventListener('submit', handleSaveNote);
    
    // View Toggle
    gridViewBtn.addEventListener('click', () => setView('grid'));
    listViewBtn.addEventListener('click', () => setView('list'));
    
    // Modal Close - Note View
    document.getElementById('closeViewModal').addEventListener('click', hideNoteViewModal);
    document.getElementById('editNoteBtn').addEventListener('click', () => {
        hideNoteViewModal();
        showEditNoteModal(currentViewingNote);
    });
    document.getElementById('deleteNoteBtn').addEventListener('click', () => {
        deleteNote(currentViewingNote);
        hideNoteViewModal();
    });
    
    // Modal Close - Note Edit
    document.getElementById('closeModal').addEventListener('click', hideNoteModal);
    document.getElementById('cancelBtn').addEventListener('click', hideNoteModal);
    
    // Modal Close - Folder
    document.getElementById('closeFolderModal').addEventListener('click', hideFolderModal);
    document.getElementById('cancelFolderBtn').addEventListener('click', hideFolderModal);
    
    // Image Upload
    document.getElementById('noteImageInput').addEventListener('change', handleImageUpload);
    document.getElementById('removeImage').addEventListener('click', removeImage);
    
    // Crop Modal
    document.getElementById('closeCropModal').addEventListener('click', hideCropModal);
    document.getElementById('cancelCrop').addEventListener('click', hideCropModal);
    document.getElementById('applyCrop').addEventListener('click', applyCrop);
    
    // Click outside modal to close
    noteViewModal.addEventListener('click', (e) => {
        if (e.target === noteViewModal) hideNoteViewModal();
    });
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) hideNoteModal();
    });
    folderModal.addEventListener('click', (e) => {
        if (e.target === folderModal) hideFolderModal();
    });
    cropModal.addEventListener('click', (e) => {
        if (e.target === cropModal) hideCropModal();
    });
}

// Authentication
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (username === 'admin' && password === 'admin') {
        isLoggedIn = true;
        localStorage.setItem('isLoggedIn', 'true');
        showMainApp();
    } else {
        alert('Invalid credentials! Use admin/admin');
    }
}

function handleLogout() {
    isLoggedIn = false;
    localStorage.removeItem('isLoggedIn');
    showLoginPage();
}

function checkLoginStatus() {
    isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    if (isLoggedIn) {
        showMainApp();
    } else {
        showLoginPage();
    }
}

function showLoginPage() {
    loginPage.classList.remove('hidden');
    mainApp.classList.add('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function showMainApp() {
    loginPage.classList.add('hidden');
    mainApp.classList.remove('hidden');
}

// Folder Management
function showAddFolderModal() {
    document.getElementById('folderName').value = '';
    folderModal.classList.remove('hidden');
}

function hideFolderModal() {
    folderModal.classList.add('hidden');
}

function handleAddFolder(e) {
    e.preventDefault();
    const folderName = document.getElementById('folderName').value.trim();
    
    if (folderName) {
        const folder = {
            id: Date.now().toString(),
            name: folderName,
            createdAt: new Date().toISOString()
        };
        
        storage.folders.push(folder);
        storage.saveFolders();
        loadFolders();
        updateNoteFolderOptions();
        hideFolderModal();
    }
}

function loadFolders() {
    const foldersHtml = storage.folders.map(folder => `
        <div class="folder-item" data-folder="${folder.id}">
            <i class="fas fa-folder"></i>
            <span>${folder.name}</span>
            <button class="folder-delete" onclick="deleteFolder('${folder.id}')" title="Delete folder">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
    
    const allNotesItem = foldersList.querySelector('[data-folder="all"]');
    foldersList.innerHTML = '';
    foldersList.appendChild(allNotesItem);
    foldersList.insertAdjacentHTML('beforeend', foldersHtml);
    
    // Add click listeners to folder items
    foldersList.querySelectorAll('.folder-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.folder-delete')) {
                selectFolder(item.dataset.folder);
            }
        });
    });
    
    updateNoteFolderOptions();
}

function selectFolder(folderId) {
    currentFolder = folderId;
    
    // Update active folder
    foldersList.querySelectorAll('.folder-item').forEach(item => {
        item.classList.remove('active');
    });
    foldersList.querySelector(`[data-folder="${folderId}"]`).classList.add('active');
    
    // Update title
    if (folderId === 'all') {
        currentFolderTitle.textContent = 'All Notes';
    } else {
        const folder = storage.folders.find(f => f.id === folderId);
        currentFolderTitle.textContent = folder ? folder.name : 'Unknown Folder';
    }
    
    loadNotes();
}

function deleteFolder(folderId) {
    if (confirm('Are you sure you want to delete this folder? Notes in this folder will not be deleted.')) {
        storage.folders = storage.folders.filter(f => f.id !== folderId);
        storage.saveFolders();
        
        // If current folder is deleted, switch to all notes
        if (currentFolder === folderId) {
            selectFolder('all');
        }
        
        loadFolders();
        updateNoteFolderOptions();
    }
}

function updateNoteFolderOptions() {
    const noteFolder = document.getElementById('noteFolder');
    const folderOptions = storage.folders.map(folder => 
        `<option value="${folder.id}">${folder.name}</option>`
    ).join('');
    
    noteFolder.innerHTML = `
        <option value="">Select folder...</option>
        ${folderOptions}
    `;
}

// Note Management
function showNoteViewModal(noteId) {
    const note = storage.notes.find(n => n.id === noteId);
    if (!note) return;
    
    currentViewingNote = noteId;
    
    // Set title
    document.getElementById('viewNoteTitle').textContent = note.title;
    
    // Set image
    const imageContainer = document.getElementById('viewNoteImage');
    const imageElement = document.getElementById('viewNoteImg');
    if (note.image) {
        imageElement.src = note.image;
        imageContainer.classList.remove('hidden');
    } else {
        imageContainer.classList.add('hidden');
    }
    
    // Set content
    document.getElementById('viewNoteContent').textContent = note.content;
    
    // Set meta info
    const folder = note.folderId ? storage.folders.find(f => f.id === note.folderId) : null;
    const folderName = folder ? folder.name : '';
    const date = new Date(note.updatedAt).toLocaleDateString();
    
    document.getElementById('viewNoteMeta').innerHTML = `
        <span>Last updated: ${date}</span>
        ${folderName ? `<span class="note-view-folder">${escapeHtml(folderName)}</span>` : ''}
    `;
    
    noteViewModal.classList.remove('hidden');
}

function hideNoteViewModal() {
    noteViewModal.classList.add('hidden');
    currentViewingNote = null;
}

function showAddNoteModal() {
    currentEditingNote = null;
    modalTitle.textContent = 'Add Note';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteFolder').value = '';
    clearImagePreview();
    noteModal.classList.remove('hidden');
}

function showEditNoteModal(noteId) {
    const note = storage.notes.find(n => n.id === noteId);
    if (!note) return;
    
    currentEditingNote = noteId;
    modalTitle.textContent = 'Edit Note';
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteFolder').value = note.folderId || '';
    
    // Show image preview if exists
    if (note.image) {
        showImagePreview(note.image);
    } else {
        clearImagePreview();
    }
    
    noteModal.classList.remove('hidden');
}

function hideNoteModal() {
    noteModal.classList.add('hidden');
    currentEditingNote = null;
    clearImagePreview();
}

function handleSaveNote(e) {
    e.preventDefault();
    const title = document.getElementById('noteTitle').value.trim();
    const content = document.getElementById('noteContent').value.trim();
    const folderId = document.getElementById('noteFolder').value;
    const previewImg = document.getElementById('previewImg');
    const image = previewImg.src && !previewImg.src.includes('data:') ? previewImg.src : 
                 previewImg.src.startsWith('data:') ? previewImg.src : null;
    
    if (title && content) {
        if (currentEditingNote) {
            // Edit existing note
            const noteIndex = storage.notes.findIndex(n => n.id === currentEditingNote);
            if (noteIndex !== -1) {
                storage.notes[noteIndex] = {
                    ...storage.notes[noteIndex],
                    title,
                    content,
                    folderId: folderId || null,
                    image: image,
                    updatedAt: new Date().toISOString()
                };
            }
        } else {
            // Add new note
            const note = {
                id: Date.now().toString(),
                title,
                content,
                folderId: folderId || null,
                image: image,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            storage.notes.push(note);
        }
        
        storage.saveNotes();
        loadNotes();
        hideNoteModal();
    }
}

// Image Handling
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
        alert('Image size should be less than 5MB.');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        showCropModal(event.target.result);
    };
    reader.readAsDataURL(file);
}

function showCropModal(imageSrc) {
    currentImage = new Image();
    currentImage.onload = function() {
        setupCropCanvas();
        cropModal.classList.remove('hidden');
    };
    currentImage.src = imageSrc;
}

function hideCropModal() {
    cropModal.classList.add('hidden');
    currentImage = null;
    cropSelection = null;
    // Reset file input
    document.getElementById('noteImageInput').value = '';
}

function setupCropCanvas() {
    cropCanvas = document.getElementById('cropCanvas');
    cropContext = cropCanvas.getContext('2d');
    
    // Calculate canvas size to fit the modal
    const maxWidth = 500;
    const maxHeight = 350;
    let { width, height } = currentImage;
    
    // Calculate scale to fit canvas while maintaining aspect ratio
    const scale = Math.min(maxWidth / width, maxHeight / height);
    const displayWidth = width * scale;
    const displayHeight = height * scale;
    
    cropCanvas.width = displayWidth;
    cropCanvas.height = displayHeight;
    
    // Draw the image
    cropContext.drawImage(currentImage, 0, 0, displayWidth, displayHeight);
    
    // Set up crop selection (16:10 aspect ratio for better card display)
    const cropWidth = Math.min(displayWidth * 0.9, displayHeight * 1.6);
    const cropHeight = cropWidth / 1.6; // 16:10 aspect ratio
    
    // If crop height is too big, adjust based on height
    if (cropHeight > displayHeight * 0.9) {
        const adjustedHeight = displayHeight * 0.9;
        const adjustedWidth = adjustedHeight * 1.6;
        cropSelection = {
            x: (displayWidth - adjustedWidth) / 2,
            y: (displayHeight - adjustedHeight) / 2,
            width: adjustedWidth,
            height: adjustedHeight,
            isDragging: false,
            isResizing: false
        };
    } else {
        cropSelection = {
            x: (displayWidth - cropWidth) / 2,
            y: (displayHeight - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight,
            isDragging: false,
            isResizing: false
        };
    }
    
    drawCropOverlay();
    setupCropEvents();
}

function drawCropOverlay() {
    cropContext.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropContext.drawImage(currentImage, 0, 0, cropCanvas.width, cropCanvas.height);
    
    // Draw overlay
    cropContext.fillStyle = 'rgba(0, 0, 0, 0.5)';
    cropContext.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // Clear selection area
    cropContext.globalCompositeOperation = 'destination-out';
    cropContext.fillRect(cropSelection.x, cropSelection.y, cropSelection.width, cropSelection.height);
    
    // Draw selection border
    cropContext.globalCompositeOperation = 'source-over';
    cropContext.strokeStyle = '#fff';
    cropContext.lineWidth = 2;
    cropContext.strokeRect(cropSelection.x, cropSelection.y, cropSelection.width, cropSelection.height);
    
    // Draw corner handles
    const handleSize = 8;
    cropContext.fillStyle = '#fff';
    // Top-left
    cropContext.fillRect(cropSelection.x - handleSize/2, cropSelection.y - handleSize/2, handleSize, handleSize);
    // Top-right
    cropContext.fillRect(cropSelection.x + cropSelection.width - handleSize/2, cropSelection.y - handleSize/2, handleSize, handleSize);
    // Bottom-left
    cropContext.fillRect(cropSelection.x - handleSize/2, cropSelection.y + cropSelection.height - handleSize/2, handleSize, handleSize);
    // Bottom-right
    cropContext.fillRect(cropSelection.x + cropSelection.width - handleSize/2, cropSelection.y + cropSelection.height - handleSize/2, handleSize, handleSize);
}

function setupCropEvents() {
    let startX, startY, startSelection;
    
    cropCanvas.addEventListener('mousedown', (e) => {
        const rect = cropCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        startX = x;
        startY = y;
        startSelection = { ...cropSelection };
        
        // Check if clicking on a corner handle (resize mode)
        const handleSize = 8;
        const corners = [
            { x: cropSelection.x, y: cropSelection.y }, // top-left
            { x: cropSelection.x + cropSelection.width, y: cropSelection.y }, // top-right
            { x: cropSelection.x, y: cropSelection.y + cropSelection.height }, // bottom-left
            { x: cropSelection.x + cropSelection.width, y: cropSelection.y + cropSelection.height } // bottom-right
        ];
        
        let isOnHandle = false;
        for (const corner of corners) {
            if (Math.abs(x - corner.x) <= handleSize && Math.abs(y - corner.y) <= handleSize) {
                isOnHandle = true;
                break;
            }
        }
        
        if (isOnHandle) {
            cropSelection.isResizing = true;
        } else if (x >= cropSelection.x && x <= cropSelection.x + cropSelection.width &&
                   y >= cropSelection.y && y <= cropSelection.y + cropSelection.height) {
            cropSelection.isDragging = true;
        }
    });
    
    cropCanvas.addEventListener('mousemove', (e) => {
        const rect = cropCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (cropSelection.isDragging) {
            const deltaX = x - startX;
            const deltaY = y - startY;
            
            const newX = Math.max(0, Math.min(startSelection.x + deltaX, cropCanvas.width - cropSelection.width));
            const newY = Math.max(0, Math.min(startSelection.y + deltaY, cropCanvas.height - cropSelection.height));
            
            cropSelection.x = newX;
            cropSelection.y = newY;
            
            drawCropOverlay();
        } else if (cropSelection.isResizing) {
            const deltaX = x - startX;
            const deltaY = y - startY;
            
            // Use the larger delta to maintain aspect ratio
            const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * (deltaX + deltaY > 0 ? 1 : -1);
            
            // Calculate new size while maintaining 16:10 aspect ratio
            const aspectRatio = 1.6;
            let newWidth = Math.max(50, startSelection.width + delta);
            let newHeight = newWidth / aspectRatio;
            
            // Ensure crop doesn't exceed canvas boundaries
            const maxWidth = cropCanvas.width - startSelection.x;
            const maxHeight = cropCanvas.height - startSelection.y;
            
            if (newWidth > maxWidth) {
                newWidth = maxWidth;
                newHeight = newWidth / aspectRatio;
            }
            
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
                newWidth = newHeight * aspectRatio;
            }
            
            cropSelection.width = newWidth;
            cropSelection.height = newHeight;
            
            drawCropOverlay();
        }
    });
    
    cropCanvas.addEventListener('mouseup', () => {
        cropSelection.isDragging = false;
        cropSelection.isResizing = false;
    });
}

function applyCrop() {
    // Create a new canvas for the cropped image
    const croppedCanvas = document.createElement('canvas');
    const croppedContext = croppedCanvas.getContext('2d');
    
    // Set high quality output size maintaining aspect ratio
    const outputWidth = 480; // 16:10 ratio, good for cards
    const outputHeight = 300;
    
    croppedCanvas.width = outputWidth;
    croppedCanvas.height = outputHeight;
    
    // Enable high quality rendering
    croppedContext.imageSmoothingEnabled = true;
    croppedContext.imageSmoothingQuality = 'high';
    
    // Calculate scale factors between display canvas and original image
    const scaleX = currentImage.width / cropCanvas.width;
    const scaleY = currentImage.height / cropCanvas.height;
    
    // Calculate source rectangle in original image coordinates
    const sourceX = cropSelection.x * scaleX;
    const sourceY = cropSelection.y * scaleY;
    const sourceWidth = cropSelection.width * scaleX;
    const sourceHeight = cropSelection.height * scaleY;
    
    // Draw cropped and resized image with high quality
    croppedContext.drawImage(
        currentImage,
        sourceX, sourceY, sourceWidth, sourceHeight,
        0, 0, outputWidth, outputHeight
    );
    
    // Convert to data URL with high quality
    const croppedImageData = croppedCanvas.toDataURL('image/jpeg', 0.92);
    
    // Show preview
    showImagePreview(croppedImageData);
    
    hideCropModal();
}

function showImagePreview(imageSrc) {
    const previewContainer = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    previewImg.src = imageSrc;
    previewContainer.classList.remove('hidden');
}

function clearImagePreview() {
    const previewContainer = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    document.getElementById('noteImageInput').value = '';
}

function removeImage() {
    clearImagePreview();
}

function deleteNote(noteId) {
    if (confirm('Are you sure you want to delete this note?')) {
        storage.notes = storage.notes.filter(n => n.id !== noteId);
        storage.saveNotes();
        loadNotes();
    }
}

function loadNotes() {
    const searchTerm = searchInput.value.toLowerCase();
    let filteredNotes = storage.notes;
    
    // Filter by folder
    if (currentFolder !== 'all') {
        filteredNotes = filteredNotes.filter(note => note.folderId === currentFolder);
    }
    
    // Filter by search term
    if (searchTerm) {
        filteredNotes = filteredNotes.filter(note => 
            note.title.toLowerCase().includes(searchTerm) ||
            note.content.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort by updated date (newest first)
    filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    if (filteredNotes.length === 0) {
        notesList.classList.add('hidden');
        emptyState.classList.remove('hidden');
    } else {
        notesList.classList.remove('hidden');
        emptyState.classList.add('hidden');
        
        const notesHtml = filteredNotes.map(note => {
            const folder = note.folderId ? storage.folders.find(f => f.id === note.folderId) : null;
            const folderName = folder ? folder.name : '';
            const date = new Date(note.updatedAt).toLocaleDateString();
            const hasImage = note.image ? 'has-image' : '';
            
            return `
                <div class="note-card ${hasImage}" onclick="showNoteViewModal('${note.id}')">
                    <div class="note-actions">
                        <button class="note-action-btn edit" onclick="event.stopPropagation(); showEditNoteModal('${note.id}')" title="Edit note">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="note-action-btn delete" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Delete note">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                    ${note.image ? `<img src="${note.image}" alt="Note image" class="note-card-image">` : ''}
                    <h3>${escapeHtml(note.title)}</h3>
                    <div class="note-content">${escapeHtml(note.content)}</div>
                    <div class="note-meta">
                        <span>${date}</span>
                        ${folderName ? `<span class="note-folder">${escapeHtml(folderName)}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        notesList.innerHTML = notesHtml;
    }
}

// Search
function handleSearch() {
    loadNotes();
}

// View Toggle
function setView(view) {
    currentView = view;
    
    gridViewBtn.classList.remove('active');
    listViewBtn.classList.remove('active');
    
    if (view === 'grid') {
        gridViewBtn.classList.add('active');
        notesList.className = 'notes-grid';
    } else {
        listViewBtn.classList.add('active');
        notesList.className = 'notes-list';
    }
}

// Utility Functions
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Sample Data (for demo purposes)
function createSampleData() {
    if (storage.notes.length === 0 && storage.folders.length === 0) {
        // Create sample folders
        const sampleFolders = [
            { id: 'work', name: 'Work', createdAt: new Date().toISOString() },
            { id: 'personal', name: 'Personal', createdAt: new Date().toISOString() }
        ];
        
        // Create sample notes
        const sampleNotes = [
            {
                id: '1',
                title: 'Welcome to Notes App',
                content: 'This is your first note! You can create, edit, and organize your notes using folders. Use the search feature to quickly find what you\'re looking for.',
                folderId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: '2',
                title: 'Meeting Notes',
                content: 'Quarterly review meeting scheduled for next week. Prepare presentation slides and gather team feedback.',
                folderId: 'work',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];
        
        storage.folders = sampleFolders;
        storage.notes = sampleNotes;
        storage.saveFolders();
        storage.saveNotes();
    }
}

// Create sample data on first load
createSampleData();