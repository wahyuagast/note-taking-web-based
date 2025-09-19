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
let quillEditor = null;
let hasUnsavedChanges = false;
let originalNoteData = null;

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
    
    // Initialize Quill editor if main app is already visible
    if (!mainApp.classList.contains('hidden')) {
        setTimeout(() => {
            if (!quillEditor) {
                initializeQuillEditor();
            }
        }, 100);
    }
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
    
    // Modal Close - Note Edit with confirmation
    document.getElementById('closeModal').addEventListener('click', (e) => {
        e.preventDefault();
        confirmCloseModal();
    });
    document.getElementById('cancelBtn').addEventListener('click', (e) => {
        e.preventDefault();
        confirmCloseModal();
    });
    
    // Modal Close - Folder
    document.getElementById('closeFolderModal').addEventListener('click', hideFolderModal);
    document.getElementById('cancelFolderBtn').addEventListener('click', hideFolderModal);
    
    // Image Upload
    document.getElementById('noteImageInput').addEventListener('change', handleImageUpload);
    document.getElementById('removeImage').addEventListener('click', removeImage);
    
    // Track changes in form inputs
    document.getElementById('noteTitle').addEventListener('input', () => {
        hasUnsavedChanges = true;
    });
    document.getElementById('noteFolder').addEventListener('change', () => {
        hasUnsavedChanges = true;
    });
    document.getElementById('noteImageInput').addEventListener('change', () => {
        hasUnsavedChanges = true;
    });
    
    // Crop Modal
    document.getElementById('closeCropModal').addEventListener('click', hideCropModal);
    document.getElementById('cancelCrop').addEventListener('click', hideCropModal);
    document.getElementById('applyCrop').addEventListener('click', applyCrop);
    
    // Click outside modal to close
    noteViewModal.addEventListener('click', (e) => {
        if (e.target === noteViewModal) hideNoteViewModal();
    });
    noteModal.addEventListener('click', (e) => {
        if (e.target === noteModal) {
            e.preventDefault();
            confirmCloseModal();
        }
    });
    folderModal.addEventListener('click', (e) => {
        if (e.target === folderModal) hideFolderModal();
    });
    cropModal.addEventListener('click', (e) => {
        if (e.target === cropModal) hideCropModal();
    });
}

// Initialize Quill Editor
function initializeQuillEditor() {
    // Custom toolbar with professional grouping
    const toolbarOptions = [
        [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
        [{ 'font': [] }],
        [{ 'size': ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'color': [] }, { 'background': [] }],
        [{ 'script': 'sub'}, { 'script': 'super' }],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        [{ 'indent': '-1'}, { 'indent': '+1' }],
        [{ 'direction': 'rtl' }],
        [{ 'align': [] }],
        ['blockquote', 'code-block'],
        ['link', 'image', 'video'],
        ['clean']
    ];

    quillEditor = new Quill('#noteContentEditor', {
        theme: 'snow',
        modules: {
            toolbar: {
                container: toolbarOptions,
                handlers: {
                    'image': imageHandler,
                    'video': videoHandler
                }
            }
        },
        placeholder: 'Start writing your note... Use the toolbar above to format your content beautifully.',
        formats: [
            'header', 'font', 'size',
            'bold', 'italic', 'underline', 'strike', 
            'color', 'background',
            'script', 'list', 'bullet', 'indent',
            'direction', 'align',
            'blockquote', 'code-block',
            'link', 'image', 'video'
        ]
    });

    // Custom image handler
    function imageHandler() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                // Check file size (limit to 5MB for inline images)
                if (file.size > 5 * 1024 * 1024) {
                    alert('Image size should be less than 5MB for inline content.');
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    // Get cursor position and insert image
                    const range = quillEditor.getSelection(true);
                    quillEditor.insertEmbed(range.index, 'image', e.target.result);
                    quillEditor.setSelection(range.index + 1);
                };
                reader.readAsDataURL(file);
            }
        };
    }

    // Custom video handler for better video embedding
    function videoHandler() {
        const range = quillEditor.getSelection();
        if (range) {
            // Create a custom prompt dialog that won't be cut off
            const videoDialog = createVideoDialog();
            document.body.appendChild(videoDialog);
            
            const urlInput = videoDialog.querySelector('#videoUrlInput');
            const insertBtn = videoDialog.querySelector('#insertVideoBtn');
            const cancelBtn = videoDialog.querySelector('#cancelVideoBtn');
            
            urlInput.focus();
            
            insertBtn.onclick = () => {
                const url = urlInput.value.trim();
                if (url) {
                    let embedUrl = convertToEmbedUrl(url);
                    if (embedUrl) {
                        quillEditor.insertEmbed(range.index, 'video', embedUrl);
                        quillEditor.setSelection(range.index + 1);
                    } else {
                        alert('Please enter a valid YouTube, Vimeo, or direct video URL.');
                        return;
                    }
                }
                document.body.removeChild(videoDialog);
            };
            
            cancelBtn.onclick = () => {
                document.body.removeChild(videoDialog);
            };
            
            // Handle Enter key
            urlInput.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    insertBtn.click();
                }
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelBtn.click();
                }
            };
        }
    }

    // Create custom video dialog
    function createVideoDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'video-embed-dialog';
        dialog.innerHTML = `
            <div class="video-dialog-content">
                <div class="video-dialog-header">
                    <h3>Embed Video</h3>
                </div>
                <div class="video-dialog-body">
                    <label for="videoUrlInput">Video URL:</label>
                    <input type="text" id="videoUrlInput" placeholder="Paste YouTube, Vimeo, or direct video URL here..." />
                    <p class="video-help">Supported: YouTube, Vimeo, and direct video links (.mp4, .webm, .ogg)</p>
                </div>
                <div class="video-dialog-actions">
                    <button type="button" id="cancelVideoBtn" class="btn-secondary">Cancel</button>
                    <button type="button" id="insertVideoBtn" class="btn-primary">Insert Video</button>
                </div>
            </div>
        `;
        return dialog;
    }

    // Convert various video URLs to embed format
    function convertToEmbedUrl(url) {
        // YouTube
        const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const youtubeMatch = url.match(youtubeRegex);
        if (youtubeMatch) {
            return `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0&modestbranding=1`;
        }

        // Vimeo
        const vimeoRegex = /(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;
        const vimeoMatch = url.match(vimeoRegex);
        if (vimeoMatch) {
            return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
        }

        // Direct video files
        const videoExtensions = /\.(mp4|webm|ogg)(\?.*)?$/i;
        if (videoExtensions.test(url)) {
            return url;
        }

        // If it's already an embed URL, return as is
        if (url.includes('embed') || url.includes('player.vimeo.com')) {
            return url;
        }

        return null;
    }

    // Sync content with hidden textarea and track changes
    quillEditor.on('text-change', function() {
        const content = quillEditor.root.innerHTML;
        document.getElementById('noteContent').value = content;
        
        // Mark as having unsaved changes
        hasUnsavedChanges = true;
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
    
    // Initialize Quill editor after main app is shown
    if (!quillEditor) {
        setTimeout(() => {
            initializeQuillEditor();
        }, 100);
    }
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
    
    // Hide image container - images are only shown on note cards, not in preview
    const imageContainer = document.getElementById('viewNoteImage');
    imageContainer.classList.add('hidden');
    
    // Set content with rich text
    const contentElement = document.getElementById('viewNoteContent');
    if (note.content) {
        // Ensure HTML content is displayed properly
        contentElement.innerHTML = note.content;
    } else {
        contentElement.innerHTML = '<p style="color: #999; font-style: italic;">No content</p>';
    }
    
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
    hasUnsavedChanges = false;
    originalNoteData = null;
    
    modalTitle.textContent = 'Add Note';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteFolder').value = '';
    
    // Clear Quill editor
    if (quillEditor) {
        quillEditor.setContents([]);
        document.getElementById('noteContent').value = '';
    }
    
    clearImagePreview();
    noteModal.classList.remove('hidden');
}

function showEditNoteModal(noteId) {
    const note = storage.notes.find(n => n.id === noteId);
    if (!note) return;
    
    currentEditingNote = noteId;
    hasUnsavedChanges = false;
    
    // Store original data for comparison
    originalNoteData = {
        title: note.title,
        content: note.content,
        folderId: note.folderId || '',
        image: note.image
    };
    
    modalTitle.textContent = 'Edit Note';
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteFolder').value = note.folderId || '';
    
    // Set Quill editor content
    if (quillEditor) {
        if (note.content) {
            // Set HTML content directly to Quill
            quillEditor.root.innerHTML = note.content;
            document.getElementById('noteContent').value = note.content;
        } else {
            quillEditor.setContents([]);
            document.getElementById('noteContent').value = '';
        }
    }
    
    // Show image preview if exists
    if (note.image) {
        showImagePreview(note.image);
    } else {
        clearImagePreview();
    }
    
    noteModal.classList.remove('hidden');
}

// Confirm before closing modal with unsaved changes
function confirmCloseModal() {
    if (hasUnsavedChanges) {
        const userChoice = confirm(
            'You have unsaved changes. Are you sure you want to close without saving?\n\n' +
            'Click "OK" to discard changes and close.\n' +
            'Click "Cancel" to continue editing.'
        );
        
        if (userChoice) {
            // User confirmed, discard changes and close
            forceCloseModal();
        }
        // If user clicked cancel, do nothing (stay in edit mode)
    } else {
        // No unsaved changes, close normally
        hideNoteModal();
    }
}

// Force close modal without confirmation
function forceCloseModal() {
    hasUnsavedChanges = false;
    originalNoteData = null;
    hideNoteModal();
}

function hideNoteModal() {
    noteModal.classList.add('hidden');
    currentEditingNote = null;
    hasUnsavedChanges = false;
    originalNoteData = null;
    
    // Clear form
    noteForm.reset();
    modalTitle.textContent = 'Add Note';
    
    // Clear Quill editor
    if (quillEditor) {
        quillEditor.setContents([]);
        document.getElementById('noteContent').value = '';
    }
    
    clearImagePreview();
}

function handleSaveNote(e) {
    e.preventDefault();
    const title = document.getElementById('noteTitle').value.trim();
    const folderId = document.getElementById('noteFolder').value;
    const previewImg = document.getElementById('previewImg');
    const image = previewImg.src && !previewImg.src.includes('data:') ? previewImg.src : 
                 previewImg.src.startsWith('data:') ? previewImg.src : null;
    
    // Get content from Quill editor
    let content = '';
    if (quillEditor) {
        content = quillEditor.root.innerHTML;
        // Update hidden textarea
        document.getElementById('noteContent').value = content;
    } else {
        content = document.getElementById('noteContent').value.trim();
    }
    
    if (title && content && content !== '<p><br></p>') { // Check for empty Quill content
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
        
        // Reset change tracking since we successfully saved
        hasUnsavedChanges = false;
        originalNoteData = null;
        
        hideNoteModal();
    } else {
        alert('Please fill in both title and content.');
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
            stripHtml(note.content).toLowerCase().includes(searchTerm)
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
            const hasImage = 'has-image'; // Always show image (either custom or default)
            const contentPreview = stripHtml(note.content);
            
            // Use custom image if available, otherwise use default from Unsplash
            const imageUrl = note.image || getDefaultImage(note.id);
            
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
                    <img src="${imageUrl}" alt="Note image" class="note-card-image">
                    <h3>${escapeHtml(note.title)}</h3>
                    <div class="note-content">${escapeHtml(contentPreview)}</div>
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

// Generate default image from Unsplash for notes without custom images
function getDefaultImage(noteId) {
    // Array of beautiful, professional Unsplash images for notes
    const defaultImages = [
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=500&fit=crop&auto=format', // Mountain landscape
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&h=500&fit=crop&auto=format', // Forest path  
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&h=500&fit=crop&auto=format', // Ocean waves
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&h=500&fit=crop&auto=format', // Sunset sky
        'https://images.unsplash.com/photo-1473773508845-188df298d2d1?w=800&h=500&fit=crop&auto=format', // Desert landscape
        'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&h=500&fit=crop&auto=format', // City skyline
        'https://images.unsplash.com/photo-1497032628192-86f99bcd76bc?w=800&h=500&fit=crop&auto=format', // Coffee workspace
        'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=500&fit=crop&auto=format', // Books and notes
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=500&fit=crop&auto=format', // Abstract gradient
        'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&h=500&fit=crop&auto=format'  // Tech workspace
    ];
    
    // Use note ID to consistently assign the same image to the same note
    const imageIndex = Math.abs(noteId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
    }, 0)) % defaultImages.length;
    
    return defaultImages[imageIndex];
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

function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
}

// Sample Data (for demo purposes)
function createSampleData() {
    if (storage.notes.length === 0 && storage.folders.length === 0) {
        // Create sample folders
        const sampleFolders = [
            { id: 'work', name: 'Work', createdAt: new Date().toISOString() },
            { id: 'personal', name: 'Personal', createdAt: new Date().toISOString() }
        ];
        
        // Create sample notes with rich text content
        const sampleNotes = [
            {
                id: '1',
                title: 'Welcome to Rich Notes App',
                content: '<h2>Welcome to the Rich Text Notes App!</h2><p>This note demonstrates the <strong>rich text editing</strong> capabilities:</p><ul><li><strong>Bold text</strong> and <em>italic text</em></li><li><u>Underlined text</u> and <span style="color: rgb(230, 0, 0);">colored text</span></li><li>Different <span style="font-size: 18px;">font sizes</span></li><li>Various headers and formatting options</li></ul><blockquote>You can also add blockquotes for emphasis!</blockquote><p>Try editing this note to explore all the formatting features.</p>',
                folderId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: '2',
                title: 'Meeting Notes - Q4 Review',
                content: '<h3>Quarterly Review Meeting</h3><p><strong>Date:</strong> Next Week</p><p><strong>Agenda:</strong></p><ol><li>Review Q3 performance metrics</li><li>Discuss Q4 goals and objectives</li><li>Team feedback session</li><li>Budget allocation for next quarter</li></ol><p><span style="background-color: rgb(255, 255, 0);">Action Items:</span></p><ul><li>Prepare presentation slides</li><li>Gather team feedback</li><li>Schedule follow-up meetings</li></ul>',
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