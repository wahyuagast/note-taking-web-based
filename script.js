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
const searchInput = document.getElementById('searchInput'); // Main search for notes
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
    
    // Initialize macOS window controls
    initializeMacOSControls();
    
    // Setup mutation observer to watch for new modals
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE && node.classList && node.classList.contains('modal')) {
                    console.log('New modal detected:', node.id);
                    setTimeout(() => {
                        setupModalControls(node);
                    }, 100);
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
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
    
    // Main Search for notes
    searchInput.addEventListener('input', handleMainSearchInput);
    searchInput.addEventListener('keydown', handleMainSearchKeydown);
    
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
        console.log('Edit button clicked, currentViewingNote:', currentViewingNote, 'type:', typeof currentViewingNote);
        if (currentViewingNote) {
            // Save the note ID before hiding the modal (which sets currentViewingNote to null)
            const noteIdToEdit = currentViewingNote;
            console.log('Saved noteIdToEdit before hiding modal:', noteIdToEdit, 'type:', typeof noteIdToEdit);
            
            hideNoteViewModal();
            
            console.log('After hideNoteViewModal, currentViewingNote:', currentViewingNote);
            console.log('Passing noteIdToEdit to showEditNoteModal:', noteIdToEdit);
            showEditNoteModal(noteIdToEdit);
        } else {
            showAppleStyleAlert({
                title: 'Error',
                message: 'No note selected for editing.',
                type: 'warning'
            });
        }
    });
    document.getElementById('deleteNoteBtn').addEventListener('click', () => {
        deleteNote(currentViewingNote);
        hideNoteViewModal();
    });
    
    // Note navigation
    document.getElementById('prevNoteBtn').addEventListener('click', showPreviousNote);
    document.getElementById('nextNoteBtn').addEventListener('click', showNextNote);
    
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
    
    // Click outside modal to close (note view modal disabled - only X button works)
    noteViewModal.addEventListener('click', (e) => {
        // Note view modal can only be closed with X button for better UX
        // This prevents accidental closes when user is reading content
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

    // Setup image resize functionality
    setupImageResizeInEditor();

    // Custom image handler
    function imageHandler() {
        const input = document.createElement('input');
        input.setAttribute('type', 'file');
        input.setAttribute('accept', 'image/*');
        input.click();

        input.onchange = () => {
            const file = input.files[0];
            if (file) {
                // Get cursor position before processing
                const range = quillEditor.getSelection(true);
                
                // Check file size (limit to 5MB for inline images)
                if (file.size > 5 * 1024 * 1024) {
                    showCustomAlert({
                        title: 'File Too Large',
                        message: 'Image size should be less than 5MB for inline content.',
                        type: 'warning'
                    });
                    return;
                }

                const reader = new FileReader();
                reader.onload = (e) => {
                    // Process image with auto-resize for inline editor
                    processImageForInlineEditor(e.target.result, range);
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
                        document.body.removeChild(videoDialog);
                    } else {
                        showCustomAlert({
                            title: 'Invalid URL',
                            message: 'Please enter a valid YouTube, Vimeo, or direct video URL.',
                            type: 'warning'
                        });
                        return;
                    }
                } else {
                    document.body.removeChild(videoDialog);
                }
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

// Image resize functionality in editor
function setupImageResizeInEditor() {
    console.log('setupImageResizeInEditor called - using safe mode');
    
    // Add mutation observer to detect new images with safe approach
    const editor = document.querySelector('#noteContentEditor .ql-editor');
    if (!editor) return;

    // Disconnect any existing observer first
    if (window.imageObserver) {
        window.imageObserver.disconnect();
    }

    // For now, disable MutationObserver to prevent Quill conflicts
    // Just process existing images with basic styling
    const images = editor.querySelectorAll('img:not(.resizable-processed)');
    images.forEach(img => {
        img.classList.add('resizable-processed');
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        console.log('Applied basic styling to image');
    });
    
    console.log(`Processed ${images.length} images with basic styling`);
}

// Open image resize modal for safe resizing
function openImageResizeModal(img) {
    console.log('Opening resize modal for image');
    
    // Create modal if it doesn't exist
    let resizeModal = document.getElementById('imageResizeModal');
    if (!resizeModal) {
        resizeModal = createImageResizeModal();
    }
    
    // Store reference to the image being resized
    resizeModal.targetImage = img;
    
    // Get current image dimensions
    const currentWidth = img.style.width || '100%';
    const currentHeight = img.style.height || 'auto';
    
    // Set modal content
    document.getElementById('resizePreviewImg').src = img.src;
    document.getElementById('widthSlider').value = parseFloat(currentWidth) || 100;
    document.getElementById('widthValue').textContent = Math.round(parseFloat(currentWidth) || 100) + '%';
    
    // Show modal
    resizeModal.classList.remove('hidden');
}

// Create the image resize modal
function createImageResizeModal() {
    const modal = document.createElement('div');
    modal.id = 'imageResizeModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <div class="macos-window-controls">
                    <button id="closeResizeModal" class="macos-btn close-btn-macos" title="Close">
                        <span class="macos-btn-icon"></span>
                    </button>
                    <button id="minimizeResizeModal" class="macos-btn minimize-btn-macos" title="Minimize">
                        <span class="macos-btn-icon"></span>
                    </button>
                    <button id="fullscreenResizeModal" class="macos-btn fullscreen-btn-macos" title="Fullscreen">
                        <span class="macos-btn-icon"></span>
                    </button>
                </div>
                <h3>🖼️ Resize Image</h3>
            </div>
            <div class="modal-body">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img id="resizePreviewImg" src="" alt="Preview" style="max-width: 300px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                </div>
                
                <div class="form-group">
                    <label for="widthSlider">Width: <span id="widthValue">100%</span></label>
                    <input type="range" id="widthSlider" min="10" max="100" value="100" 
                           style="width: 100%; margin: 10px 0; height: 6px; border-radius: 3px; background: #ddd; outline: none;">
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 20px; font-size: 14px; color: #666;">
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 500;">Small</div>
                        <div>25-50%</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 500;">Medium</div>
                        <div>50-75%</div>
                    </div>
                    <div style="text-align: center; flex: 1;">
                        <div style="font-weight: 500;">Large</div>
                        <div>75-100%</div>
                    </div>
                </div>
            </div>
            <div class="modal-footer" style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="cancelResize" class="btn-secondary">Cancel</button>
                <button type="button" id="applyResize" class="btn-primary">Apply</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup macOS controls for this new modal
    setupModalControls(modal);
    
    // Add event listeners
    const widthSlider = modal.querySelector('#widthSlider');
    const widthValue = modal.querySelector('#widthValue');
    const previewImg = modal.querySelector('#resizePreviewImg');
    
    widthSlider.addEventListener('input', function() {
        const value = this.value;
        widthValue.textContent = value + '%';
        previewImg.style.width = value + '%';
    });
    
    modal.querySelector('#closeResizeModal').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    modal.querySelector('#cancelResize').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
    modal.querySelector('#applyResize').addEventListener('click', () => {
        applyImageResize(modal);
    });
    
    return modal;
}

// Apply the resize to the target image
function applyImageResize(modal) {
    const targetImage = modal.targetImage;
    const newWidth = document.getElementById('widthSlider').value + '%';
    
    if (targetImage) {
        targetImage.style.width = newWidth;
        targetImage.style.height = 'auto';
        
        // Update editor content
        if (quillEditor) {
            const content = quillEditor.root.innerHTML;
            document.getElementById('noteContent').value = content;
            hasUnsavedChanges = true;
        }
        
        showToast(`Image resized to ${newWidth}`, 'success');
        
        console.log('Image resized to:', newWidth);
    }
    
    modal.classList.add('hidden');
    
    // Re-initialize macOS controls for any new modals
    setTimeout(() => {
        initializeMacOSControls();
    }, 100);
}

// macOS Window Controls functionality
function initializeMacOSControls() {
    console.log('Initializing macOS window controls');
    
    // Get all existing modals
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        setupModalControls(modal);
    });
}

// Setup controls for a specific modal
function setupModalControls(modal) {
    const modalId = modal.id;
    console.log('Setting up controls for modal:', modalId);
    
    // Skip modals that don't have macOS controls (like confirmDialog)
    const macosControls = modal.querySelector('.macos-window-controls');
    if (!macosControls) {
        console.log('No macOS controls found in modal:', modalId, '- skipping');
        return;
    }
    
    // Remove existing event listeners to prevent duplicates
    const closeBtn = modal.querySelector('.close-btn-macos');
    const minimizeBtn = modal.querySelector('.minimize-btn-macos');
    const fullscreenBtn = modal.querySelector('.fullscreen-btn-macos');
    
    console.log('Found close button:', !!closeBtn);
    console.log('Found minimize button:', !!minimizeBtn);
    console.log('Found maximize button:', !!fullscreenBtn);
    
    if (closeBtn && !closeBtn.dataset.initialized) {
        closeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModalWithAnimation(modal);
        });
        closeBtn.dataset.initialized = 'true';
        console.log('Added close handler for', modalId);
    }
    
    if (minimizeBtn && !minimizeBtn.dataset.initialized) {
        minimizeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            minimizeModal(modal);
        });
        minimizeBtn.dataset.initialized = 'true';
        console.log('Added minimize handler for', modalId);
    }
    
    if (fullscreenBtn && !fullscreenBtn.dataset.initialized) {
        fullscreenBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFullscreen(modal);
        });
        fullscreenBtn.dataset.initialized = 'true';
        console.log('Added maximize handler for', modalId);
    } else if (!fullscreenBtn) {
        console.error('Maximize button not found in modal:', modalId);
    }
}

// Simple toast notification system
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#28cd41' : type === 'error' ? '#ff5f57' : '#007AFF'};
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        max-width: 300px;
        backdrop-filter: blur(10px);
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
    }, 10);
    
    // Auto remove after 1.5 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 1500);
}

// Minimize modal functionality
function minimizeModal(modal) {
    console.log('Minimizing modal:', modal.id);
    
    // If already minimized, don't do anything
    if (modal.classList.contains('minimized')) {
        return;
    }
    
    // Add minimizing animation class
    modal.classList.add('minimizing');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        modal.classList.add('minimized');
        modal.classList.remove('minimizing');
        
        // Create minimize indicator in taskbar area
        createMinimizedIndicator(modal);
        
        showToast('Modal minimized', 'info');
    }, 800); // Match animation duration
}

// Restore modal from minimized state
function restoreModal(modal) {
    console.log('Restoring modal:', modal.id);
    
    // Make modal visible and interactive again
    modal.style.visibility = 'visible';
    modal.style.zIndex = '9999';
    modal.classList.add('restoring');
    modal.classList.remove('minimized');
    
    setTimeout(() => {
        modal.classList.remove('restoring');
        modal.style.zIndex = ''; // Reset to default
    }, 400);
    
    // Remove minimize indicator
    removeMinimizedIndicator(modal.id);
}

// Toggle fullscreen mode with Apple-style animation
function toggleFullscreen(modal) {
    console.log('Toggling fullscreen for modal:', modal.id);
    
    const isFullscreen = modal.classList.contains('fullscreen');
    
    if (isFullscreen) {
        // Exit fullscreen with animation
        modal.classList.add('restoring-fullscreen');
        
        setTimeout(() => {
            modal.classList.remove('fullscreen', 'restoring-fullscreen');
        }, 400);
        
        showToast('Exited maximize mode', 'success');
        
        // Exit browser fullscreen if possible
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {
                // Ignore errors - not all browsers support this
            });
        }
    } else {
        // Enter fullscreen with animation
        modal.classList.add('maximizing');
        
        setTimeout(() => {
            modal.classList.remove('maximizing');
            modal.classList.add('fullscreen');
        }, 400);
        
        showToast('Entered maximize mode', 'success');
        
        // Optional: Use browser fullscreen API for true fullscreen
        // Commented out as it might be too aggressive for normal use
        // if (modal.requestFullscreen) {
        //     modal.requestFullscreen().catch(() => {
        //         // Fallback to CSS fullscreen
        //     });
        // }
    }
}

// Close modal with animation
function closeModalWithAnimation(modal) {
    console.log('Closing modal with animation:', modal.id);
    
    // Special handling for noteModal - check for unsaved changes
    if (modal.id === 'noteModal') {
        confirmCloseModal();
        return;
    }
    
    // Add closing animation class
    modal.classList.add('closing');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('closing', 'fullscreen', 'minimized');
        
        // Specific close handlers for different modals
        if (modal.id === 'noteViewModal') {
            hideNoteViewModal();
        } else if (modal.id === 'folderModal') {
            hideFolderModal();
        } else if (modal.id === 'cropModal') {
            hideCropModal();
        }
        
        showToast('Modal closed', 'error');
    }, 500); // Match animation duration
}

// Create minimized modal indicator
function createMinimizedIndicator(modal) {
    // Remove existing indicator
    removeMinimizedIndicator(modal.id);
    
    const indicator = document.createElement('div');
    indicator.id = `minimized-${modal.id}`;
    indicator.className = 'minimized-indicator';
    
    // Position based on existing indicators
    const existingIndicators = document.querySelectorAll('.minimized-indicator');
    const bottomOffset = 20 + (existingIndicators.length * 60);
    
    indicator.style.bottom = bottomOffset + 'px';
    indicator.innerHTML = `
        <div class="minimized-content">
            <span class="minimized-icon">📄</span>
            <span class="minimized-title">${getModalTitle(modal)}</span>
        </div>
    `;
    
    indicator.addEventListener('click', () => {
        restoreModal(modal);
    });
    
    // Add to body instead of header to avoid layout issues
    document.body.appendChild(indicator);
}

// Remove minimized indicator
function removeMinimizedIndicator(modalId) {
    const indicator = document.getElementById(`minimized-${modalId}`);
    if (indicator) {
        indicator.remove();
    }
}

// Get modal title for indicator
function getModalTitle(modal) {
    const titleElement = modal.querySelector('h3');
    return titleElement ? titleElement.textContent : 'Modal';
}

function makeImageResizable(img) {
    try {
        // Avoid adding resize handles multiple times
        if (!img || img.closest('.resizable-image-container')) return;
        
        console.log('Making image resizable:', img.src ? img.src.substring(0, 50) + '...' : 'no src');

    // Create container
    const container = document.createElement('div');
    container.className = 'resizable-image-container';
    container.style.cssText = `
        position: relative;
        display: inline-block;
        border: 2px dashed transparent;
        margin: 8px 0;
    `;

    // Wrap image in container
    img.parentNode.insertBefore(container, img);
    container.appendChild(img);

    // Add resize handles
    const handles = ['nw', 'ne', 'sw', 'se'];
    handles.forEach(handle => {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = `resize-handle resize-${handle}`;
        resizeHandle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: var(--primary-blue);
            border: 1px solid white;
            border-radius: 50%;
            cursor: ${handle.includes('n') && handle.includes('w') || handle.includes('s') && handle.includes('e') ? 'nw-resize' : 'ne-resize'};
            display: none;
            z-index: 10;
        `;

        // Position handles
        if (handle.includes('n')) resizeHandle.style.top = '-4px';
        if (handle.includes('s')) resizeHandle.style.bottom = '-4px';
        if (handle.includes('w')) resizeHandle.style.left = '-4px';
        if (handle.includes('e')) resizeHandle.style.right = '-4px';

        container.appendChild(resizeHandle);

        // Add resize functionality
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = parseInt(getComputedStyle(img).width, 10);
            startHeight = parseInt(getComputedStyle(img).height, 10);

            document.addEventListener('mousemove', handleResize);
            document.addEventListener('mouseup', stopResize);
        });

        function handleResize(e) {
            if (!isResizing) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newWidth = startWidth;
            let newHeight = startHeight;

            if (handle.includes('e')) newWidth = startWidth + deltaX;
            if (handle.includes('w')) newWidth = startWidth - deltaX;
            if (handle.includes('s')) newHeight = startHeight + deltaY;
            if (handle.includes('n')) newHeight = startHeight - deltaY;

            // Maintain aspect ratio
            const aspectRatio = img.naturalWidth / img.naturalHeight;
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                newHeight = newWidth / aspectRatio;
            } else {
                newWidth = newHeight * aspectRatio;
            }

            // Set minimum size
            newWidth = Math.max(50, newWidth);
            newHeight = Math.max(50, newHeight);

            img.style.width = newWidth + 'px';
            img.style.height = newHeight + 'px';
        }

        function stopResize() {
            isResizing = false;
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', stopResize);
        }
    });

    // Show/hide handles on hover
    container.addEventListener('mouseenter', () => {
        container.style.borderColor = 'var(--primary-blue)';
        container.querySelectorAll('.resize-handle').forEach(handle => {
            handle.style.display = 'block';
        });
    });

    container.addEventListener('mouseleave', () => {
        container.style.borderColor = 'transparent';
        container.querySelectorAll('.resize-handle').forEach(handle => {
            handle.style.display = 'none';
        });
    });

    // Add crop button
    const cropBtn = document.createElement('button');
    cropBtn.innerHTML = '✂️';
    cropBtn.className = 'image-crop-btn';
    cropBtn.style.cssText = `
        position: absolute;
        top: -12px;
        right: -12px;
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 50%;
        background: var(--primary-blue);
        color: white;
        font-size: 10px;
        cursor: pointer;
        display: none;
        z-index: 11;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    cropBtn.addEventListener('click', () => {
        openImageCropModal(img);
    });

    container.appendChild(cropBtn);

    // Show crop button on hover
    container.addEventListener('mouseenter', () => {
        cropBtn.style.display = 'block';
    });

    container.addEventListener('mouseleave', () => {
        cropBtn.style.display = 'none';
    });
    } catch (error) {
        console.error('Error making image resizable:', error);
        // If error occurs, at least ensure image is visible
        if (img) {
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
        }
    }
}

function openImageCropModal(img) {
    // Create a temporary crop modal for the editor
    const modal = document.createElement('div');
    modal.className = 'image-crop-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;

    const cropContainer = document.createElement('div');
    cropContainer.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 12px;
        max-width: 90%;
        max-height: 90%;
        overflow: auto;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Crop Image';
    title.style.marginBottom = '15px';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    const maxSize = 500;
    const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight);
    canvas.width = img.naturalWidth * scale;
    canvas.height = img.naturalHeight * scale;
    
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 10px;
        margin-top: 15px;
        justify-content: flex-end;
    `;

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.onclick = () => document.body.removeChild(modal);

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Apply Crop';
    applyBtn.className = 'btn-primary';
    applyBtn.onclick = () => {
        // For now, just close modal - crop functionality can be enhanced later
        document.body.removeChild(modal);
    };

    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(applyBtn);

    cropContainer.appendChild(title);
    cropContainer.appendChild(canvas);
    cropContainer.appendChild(buttonContainer);
    modal.appendChild(cropContainer);

    document.body.appendChild(modal);
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
        showCustomAlert({
            title: 'Invalid Credentials',
            message: 'Invalid credentials! Use admin/admin',
            type: 'danger'
        });
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
    
    // Setup modal controls
    setupModalControls(folderModal);
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

async function deleteFolder(folderId) {
    const folder = storage.folders.find(f => f.id === folderId);
    if (!folder) return;
    
    const confirmed = await showCustomConfirm({
        title: 'Delete Folder',
        message: `Are you sure you want to delete the folder "${folder.name}"?\n\nNotes in this folder will not be deleted, but they will be moved to "No Folder".`,
        type: 'warning',
        okText: 'Delete Folder',
        cancelText: 'Cancel'
    });
    
    if (confirmed) {
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
    console.log('Set currentViewingNote to:', currentViewingNote, 'type:', typeof currentViewingNote);
    
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
    
    // Store original content for search functionality
    storeOriginalContent();
    
    // Clear any previous search
    clearSearchAndRestore();
    
    // Setup search listeners
    setupSearchListeners();
    
    // Set meta info
    const folder = note.folderId ? storage.folders.find(f => f.id === note.folderId) : null;
    const folderName = folder ? folder.name : '';
    const date = new Date(note.updatedAt).toLocaleDateString();
    
    document.getElementById('viewNoteMeta').innerHTML = `
        <span>Last updated: ${date}</span>
        ${folderName ? `<span class="note-view-folder">${escapeHtml(folderName)}</span>` : ''}
    `;
    
    noteViewModal.classList.remove('hidden');
    
    // Setup modal controls
    setupModalControls(noteViewModal);
    
    // Setup search functionality
    setupSearchListeners();
    
    // Update navigation button states
    updateNavigationButtons();
}

function hideNoteViewModal() {
    // Stop all videos before closing modal
    stopAllVideos();
    
    // Clear search when closing modal
    clearSearchAndRestore();
    
    // Add closing animation
    noteViewModal.classList.add('closing');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        noteViewModal.classList.add('hidden');
        noteViewModal.classList.remove('closing', 'fullscreen', 'minimized');
        currentViewingNote = null;
    }, 300); // Match animation duration
}

// Function to stop all embedded videos in the note preview
function stopAllVideos() {
    const contentElement = document.getElementById('viewNoteContent');
    
    // Stop YouTube videos
    const youtubeIframes = contentElement.querySelectorAll('iframe[src*="youtube.com"], iframe[src*="youtu.be"]');
    youtubeIframes.forEach(iframe => {
        const src = iframe.src;
        iframe.src = '';
        iframe.src = src; // This will reload and stop the video
    });
    
    // Stop Vimeo videos
    const vimeoIframes = contentElement.querySelectorAll('iframe[src*="vimeo.com"]');
    vimeoIframes.forEach(iframe => {
        try {
            iframe.contentWindow.postMessage('{"method":"pause"}', '*');
        } catch (e) {
            // Fallback: reload iframe
            const src = iframe.src;
            iframe.src = '';
            iframe.src = src;
        }
    });
    
    // Stop HTML5 videos
    const videoElements = contentElement.querySelectorAll('video');
    videoElements.forEach(video => {
        video.pause();
        video.currentTime = 0;
    });
}

// Get filtered notes for current folder
function getFilteredNotes() {
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
    
    // Sort by update date (newest first)
    return filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// Navigate to previous note
function showPreviousNote() {
    if (!currentViewingNote) return;
    
    const filteredNotes = getFilteredNotes();
    const currentIndex = filteredNotes.findIndex(note => note.id === currentViewingNote);
    
    if (currentIndex > 0) {
        const prevNote = filteredNotes[currentIndex - 1];
        showNoteViewModal(prevNote.id);
    }
    
    updateNavigationButtons();
}

// Navigate to next note
function showNextNote() {
    if (!currentViewingNote) return;
    
    const filteredNotes = getFilteredNotes();
    const currentIndex = filteredNotes.findIndex(note => note.id === currentViewingNote);
    
    if (currentIndex < filteredNotes.length - 1) {
        const nextNote = filteredNotes[currentIndex + 1];
        showNoteViewModal(nextNote.id);
    }
    
    updateNavigationButtons();
}

// Update navigation button states
function updateNavigationButtons() {
    if (!currentViewingNote) return;
    
    const filteredNotes = getFilteredNotes();
    const currentIndex = filteredNotes.findIndex(note => note.id === currentViewingNote);
    
    const prevBtn = document.getElementById('prevNoteBtn');
    const nextBtn = document.getElementById('nextNoteBtn');
    
    // Disable prev button if at first note
    prevBtn.disabled = currentIndex <= 0;
    
    // Disable next button if at last note
    nextBtn.disabled = currentIndex >= filteredNotes.length - 1;
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
    console.log('showEditNoteModal called with noteId:', noteId, 'type:', typeof noteId);
    console.log('Available notes in storage:', storage.notes.length, 'notes');
    console.log('Storage notes IDs:', storage.notes.map(n => ({id: n.id, type: typeof n.id, title: n.title})));
    
    // Ensure noteId is treated as string for comparison
    const targetId = String(noteId);
    const note = storage.notes.find(n => String(n.id) === targetId);
    
    if (!note) {
        console.error('Note not found:', noteId, 'Available notes:', storage.notes.map(n => ({id: n.id, title: n.title})));
        showAppleStyleAlert({
            title: 'Error',
            message: 'Note not found. Please try again.',
            type: 'error'
        });
        return;
    }
    
    console.log('Found note to edit:', note.title, 'with ID:', note.id);
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
            console.log('Setting content to Quill editor:', note.content.substring(0, 100) + '...');
            quillEditor.root.innerHTML = note.content;
            document.getElementById('noteContent').value = note.content;
            console.log('Content set, processing images...');
            // Process images after content is set
            setTimeout(() => processExistingImages(), 100);
        } else {
            console.log('No content to set, clearing editor');
            quillEditor.setContents([]);
            document.getElementById('noteContent').value = '';
        }
    } else {
        console.error('quillEditor not found!');
    }
    
    // Show image preview if exists
    if (note.image) {
        showImagePreview(note.image);
    } else {
        clearImagePreview();
    }
    // Show modal
    console.log('Showing edit modal (noteModal)');
    noteModal.classList.remove('hidden');
    
    // Setup modal controls with extra debugging for noteModal
    console.log('About to setup controls for noteModal');
    const allButtons = noteModal.querySelectorAll('.macos-btn');
    console.log('All macOS buttons found:', allButtons.length);
    allButtons.forEach((btn, index) => {
        console.log(`Button ${index}:`, btn.className, btn.id, btn.title);
    });
    
    setupModalControls(noteModal);
}

// Process existing images in the editor content
function processExistingImages() {
    console.log('processExistingImages called - using safe mode');
    if (!quillEditor) {
        console.error('No quillEditor found');
        return;
    }
    
    const editor = quillEditor.root;
    const images = editor.querySelectorAll('img');
    console.log(`Found ${images.length} images in editor content`);
    
    images.forEach((img, index) => {
        console.log(`Processing image ${index + 1}:`, img.src ? img.src.substring(0, 50) + '...' : 'no src');
        
        // Make sure image is visible and properly styled
        img.style.display = '';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.borderRadius = '8px';
        img.style.margin = '8px 0';
        img.style.cursor = 'pointer';
        img.style.transition = 'transform 0.2s ease';
        
        // Mark as processed
        img.classList.add('resizable-processed');
        
        // Add click handler for resize modal
        img.addEventListener('click', function(e) {
            e.preventDefault();
            openImageResizeModal(this);
        });
        
        // Add hover effect
        img.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.02)';
        });
        
        img.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
        
        console.log('Applied safe styling and resize handler to existing image');
    });
}

// Confirm before closing modal with unsaved changes
async function confirmCloseModal() {
    if (hasUnsavedChanges) {
        const confirmed = await showCustomConfirm({
            title: 'Unsaved Changes',
            message: 'You have unsaved changes. Are you sure you want to close without saving?\n\nYour changes will be lost if you continue.',
            type: 'warning',
            okText: 'Discard Changes',
            cancelText: 'Continue Editing'
        });
        
        if (confirmed) {
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
    // Add closing animation
    noteModal.classList.add('closing');
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        noteModal.classList.add('hidden');
        noteModal.classList.remove('closing', 'fullscreen', 'minimized');
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
    }, 300); // Match animation duration
    
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
        
        // Show success message
        showSuccessMessage(isEditing ? 'Note updated successfully!' : 'Note saved successfully!');
    } else {
        showCustomAlert({
            title: 'Incomplete Note',
            message: 'Please fill in both title and content.',
            type: 'warning'
        });
    }
}

// Image Handling
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
        showCustomAlert({
            title: 'Invalid File Type',
            message: 'Please select an image file.',
            type: 'warning'
        });
        return;
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showCustomAlert({
            title: 'File Too Large',
            message: 'Image size should be less than 5MB.',
            type: 'warning'
        });
        return;
    }

    // Show recommendation and process image
    showImageSizeRecommendation();
    
    const reader = new FileReader();
    reader.onload = function(event) {
        processImageWithAutoResize(event.target.result);
    };
    reader.readAsDataURL(file);
}

// Image processing constants
const RECOMMENDED_IMAGE_SIZE = {
    width: 800,
    height: 600,
    displayText: '800×600px'
};

function showImageSizeRecommendation() {
    showCustomAlert({
        title: 'Image Size Recommendation',
        message: `For optimal display in note cards, we recommend images with dimensions up to ${RECOMMENDED_IMAGE_SIZE.displayText}. Larger images will be automatically resized to fit.`,
        type: 'info'
    });
}

function processImageWithAutoResize(imageSrc) {
    const img = new Image();
    img.onload = function() {
        const { width, height } = img;
        
        // Check if image needs resizing
        if (width > RECOMMENDED_IMAGE_SIZE.width || height > RECOMMENDED_IMAGE_SIZE.height) {
            // Auto-resize the image
            const resizedImageSrc = resizeImageToRecommended(img);
            showCropModal(resizedImageSrc);
        } else {
            // Image is within recommended size, proceed normally
            showCropModal(imageSrc);
        }
    };
    img.src = imageSrc;
}

function resizeImageToRecommended(img) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const { width: originalWidth, height: originalHeight } = img;
    const maxWidth = RECOMMENDED_IMAGE_SIZE.width;
    const maxHeight = RECOMMENDED_IMAGE_SIZE.height;
    
    // Calculate new dimensions maintaining aspect ratio
    let newWidth, newHeight;
    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > originalHeight) {
        // Landscape
        newWidth = Math.min(maxWidth, originalWidth);
        newHeight = newWidth / aspectRatio;
        
        if (newHeight > maxHeight) {
            newHeight = maxHeight;
            newWidth = newHeight * aspectRatio;
        }
    } else {
        // Portrait or square
        newHeight = Math.min(maxHeight, originalHeight);
        newWidth = newHeight * aspectRatio;
        
        if (newWidth > maxWidth) {
            newWidth = maxWidth;
            newHeight = newWidth / aspectRatio;
        }
    }
    
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // Draw resized image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);
    
    return canvas.toDataURL('image/jpeg', 0.9);
}

function processImageForInlineEditor(imageSrc, range) {
    const img = new Image();
    img.onload = function() {
        const { width, height } = img;
        
        let finalImageSrc = imageSrc;
        
        // Check if image needs resizing for inline editor
        if (width > RECOMMENDED_IMAGE_SIZE.width || height > RECOMMENDED_IMAGE_SIZE.height) {
            // Auto-resize the image
            finalImageSrc = resizeImageToRecommended(img);
        }
        
        // Insert directly into editor
        try {
            quillEditor.insertEmbed(range.index, 'image', finalImageSrc);
            quillEditor.setSelection(range.index + 1);
            
            // Debug: Check if image was inserted
            console.log('Image inserted. Editor contents:', quillEditor.getContents());
        } catch (error) {
            console.error('Error inserting image:', error);
            // Fallback: insert as HTML
            const imgHtml = `<img src="${finalImageSrc}" style="max-width: 100%; height: auto; border-radius: 8px; margin: 8px 0;">`;
            quillEditor.clipboard.dangerouslyPasteHTML(range.index, imgHtml);
        }
        
        // Setup resize functionality for the new image with delay
        setTimeout(() => {
            try {
                // Use a safer approach - find images and make them resizable without triggering Quill events
                const editorImages = document.querySelectorAll('.ql-editor img:not(.resizable-processed)');
                console.log('Images found after insert:', editorImages.length);
                
                editorImages.forEach(img => {
                    // Mark as processed to avoid double processing
                    img.classList.add('resizable-processed');
                    
                    // Apply basic styling
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.borderRadius = '8px';
                    img.style.margin = '8px 0';
                    img.style.cursor = 'pointer';
                    img.style.transition = 'transform 0.2s ease';
                    
                    // Add click handler for resize modal
                    img.addEventListener('click', function(e) {
                        e.preventDefault();
                        openImageResizeModal(this);
                    });
                    
                    // Add hover effect
                    img.addEventListener('mouseenter', function() {
                        this.style.transform = 'scale(1.02)';
                    });
                    
                    img.addEventListener('mouseleave', function() {
                        this.style.transform = 'scale(1)';
                    });
                });
            } catch (error) {
                console.error('Error setting up image resize:', error);
            }
        }, 200);
    };
    img.src = imageSrc;
}

function showCropModal(imageSrc) {
    currentImage = new Image();
    currentImage.onload = function() {
        setupCropCanvas();
        cropModal.classList.remove('hidden');
        
        // Setup modal controls
        setupModalControls(cropModal);
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

async function deleteNote(noteId) {
    const note = storage.notes.find(n => n.id === noteId);
    if (!note) return;
    
    const confirmed = await showCustomConfirm({
        title: 'Delete Note',
        message: `Are you sure you want to delete "${note.title}"?\n\nThis action cannot be undone.`,
        type: 'danger',
        okText: 'Delete',
        cancelText: 'Cancel'
    });
    
    if (confirmed) {
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
            
            // Determine content length class
            let contentLengthClass = '';
            if (contentPreview.length < 50) {
                contentLengthClass = 'short';
            } else if (contentPreview.length < 150) {
                contentLengthClass = 'medium';
            } else {
                contentLengthClass = 'long';
            }
            
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
                    <div class="note-content ${contentLengthClass}">${escapeHtml(contentPreview)}</div>
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

// Custom Confirmation Dialog
function showCustomConfirm(options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Confirm Action',
            message = 'Are you sure you want to proceed?',
            type = 'danger', // danger, warning, success, info
            okText = 'OK',
            cancelText = 'Cancel'
        } = options;

        const confirmDialog = document.getElementById('confirmDialog');
        const confirmContent = confirmDialog.querySelector('.confirm-dialog-content');
        const confirmTitle = document.getElementById('confirmTitle');
        const confirmMessage = document.getElementById('confirmMessage');
        const confirmOk = document.getElementById('confirmOk');
        const confirmCancel = document.getElementById('confirmCancel');

        // Set content
        confirmTitle.textContent = title;
        confirmMessage.textContent = message;
        confirmOk.textContent = okText;
        confirmCancel.textContent = cancelText;

        // Set type styling
        confirmContent.className = `modal-content confirm-dialog-content ${type}`;

        // Set icon based on type
        const iconElement = confirmDialog.querySelector('.confirm-icon i');
        switch (type) {
            case 'warning':
                iconElement.className = 'fas fa-exclamation-triangle';
                confirmOk.className = 'btn-warning';
                break;
            case 'success':
                iconElement.className = 'fas fa-check-circle';
                confirmOk.className = 'btn-success';
                break;
            case 'info':
                iconElement.className = 'fas fa-info-circle';
                confirmOk.className = 'btn-primary';
                break;
            default: // danger
                iconElement.className = 'fas fa-exclamation-triangle';
                confirmOk.className = 'btn-danger';
        }

        // Show dialog
        confirmDialog.classList.remove('hidden');

        // Event handlers
        const handleOk = () => {
            confirmDialog.classList.add('hidden');
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            confirmDialog.classList.add('hidden');
            cleanup();
            resolve(false);
        };

        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleOk();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
            }
        };

        const handleClickOutside = (e) => {
            if (e.target === confirmDialog) {
                handleCancel();
            }
        };

        const cleanup = () => {
            confirmOk.removeEventListener('click', handleOk);
            confirmCancel.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeydown);
            confirmDialog.removeEventListener('click', handleClickOutside);
        };

        // Add event listeners
        confirmOk.addEventListener('click', handleOk);
        confirmCancel.addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleKeydown);
        confirmDialog.addEventListener('click', handleClickOutside);

        // Focus the cancel button by default for safety
        setTimeout(() => confirmCancel.focus(), 100);
    });
}

// Custom Alert Dialog (for information/warnings)
function showCustomAlert(options = {}) {
    const {
        title = 'Information',
        message = 'Please note this information.',
        type = 'info', // info, warning, success, danger
        okText = 'OK'
    } = options;

    return showAppleStyleAlert({
        title,
        message,
        type,
        okText
    });
}

function showAppleStyleAlert(options = {}) {
    return new Promise((resolve) => {
        const {
            title = 'Information',
            message = 'Please note this information.',
            type = 'info',
            okText = 'OK'
        } = options;

        // Create modal overlay with macOS styling
        const overlay = document.createElement('div');
        overlay.className = 'macos-alert-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(40px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        `;

        // Create alert container with macOS design
        const alertContainer = document.createElement('div');
        alertContainer.className = 'macos-alert-container';
        alertContainer.style.cssText = `
            max-width: 420px;
            border-radius: 12px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.1);
            animation: slideIn 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.2);
            text-align: center;
        `;

        // Get icon and styling based on type
        let iconClass, buttonClass;
        switch (type) {
            case 'warning':
                iconClass = 'fas fa-exclamation-triangle';
                buttonClass = 'btn-warning';
                break;
            case 'success':
                iconClass = 'fas fa-check-circle';
                buttonClass = 'btn-success';
                break;
            case 'info':
                iconClass = 'fas fa-info-circle';
                buttonClass = 'btn-primary';
                break;
            case 'danger':
                iconClass = 'fas fa-exclamation-triangle';
                buttonClass = 'btn-danger';
                break;
            default:
                iconClass = 'fas fa-info-circle';
                buttonClass = 'btn-primary';
        }

        // Create content with macOS structure
        alertContainer.innerHTML = `
            <div style="
                background: none;
                color: #1d1d1f;
                padding: 24px 24px 8px 24px;
                text-align: center;
                position: relative;
            ">
                <div style="
                    font-size: 3rem;
                    margin-bottom: 16px;
                    opacity: 1;
                    color: ${type === 'warning' ? '#FF9500' : type === 'success' ? '#34C759' : type === 'danger' ? '#FF3B30' : '#007AFF'};
                ">
                    <i class="${iconClass}"></i>
                </div>
                <h3 style="
                    margin: 0;
                    font-size: 17px;
                    font-weight: 600;
                    letter-spacing: -0.4px;
                    line-height: 1.3;
                    color: #1d1d1f;
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, 'Segoe UI', sans-serif;
                ">${title}</h3>
            </div>
            <div style="
                padding: 8px 24px 24px 24px;
                text-align: center;
                background: none;
            ">
                <p style="
                    margin: 0 0 24px 0;
                    color: #86868b;
                    font-size: 13px;
                    line-height: 1.5;
                    white-space: pre-line;
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif;
                    font-weight: 400;
                    letter-spacing: -0.08px;
                ">${message}</p>
                <button class="macos-alert-ok ${buttonClass}" style="
                    padding: 8px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    min-width: 80px;
                    text-transform: none;
                    letter-spacing: -0.08px;
                    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', Inter, 'Segoe UI', sans-serif;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto;
                    ${type === 'warning' ? 'background: #FF9500; color: white;' : 
                      type === 'success' ? 'background: #34C759; color: white;' : 
                      type === 'danger' ? 'background: #FF3B30; color: white;' : 
                      'background: #007AFF; color: white;'}
                ">${okText}</button>
            </div>
        `;

        overlay.appendChild(alertContainer);
        document.body.appendChild(overlay);

        // Add macOS specific CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideIn {
                from { 
                    opacity: 0;
                    transform: scale(0.92) translateY(-20px);
                }
                to { 
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            .macos-alert-ok:hover {
                opacity: 0.9;
                transform: none;
                box-shadow: none;
            }
            .macos-alert-ok:active {
                transform: scale(0.98);
            }
        `;
        document.head.appendChild(style);

        // Event handlers
        const okButton = alertContainer.querySelector('.macos-alert-ok');
        
        const handleOk = () => {
            overlay.style.animation = 'fadeIn 0.2s ease reverse';
            alertContainer.style.animation = 'slideIn 0.2s ease reverse';
            setTimeout(() => {
                document.body.removeChild(overlay);
                document.head.removeChild(style);
                resolve(true);
            }, 200);
        };

        okButton.addEventListener('click', handleOk);
        
        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleOk();
            }
        });

        // Close on Escape key
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                document.removeEventListener('keydown', handleKeydown);
                handleOk();
            }
        };
        document.addEventListener('keydown', handleKeydown);

        // Focus the OK button
        setTimeout(() => okButton.focus(), 100);
    });
}

// Success notification function
function showSuccessMessage(message) {
    showCustomAlert({
        title: 'Success',
        message: message,
        type: 'success'
    });
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

// Search functionality for note view
let searchResults = [];
let currentSearchIndex = -1;
let originalNoteContent = '';

// Store original content when note is opened
function storeOriginalContent() {
    const noteContent = document.getElementById('viewNoteContent');
    originalNoteContent = noteContent.innerHTML;
}

function clearSearchAndRestore() {
    const noteContent = document.getElementById('viewNoteContent');
    const searchInput = document.getElementById('noteSearchInput');
    const searchInfo = document.getElementById('searchInfo');
    
    if (originalNoteContent) {
        noteContent.innerHTML = originalNoteContent;
    }
    
    if (searchInput) {
        searchInput.value = '';
    }
    
    if (searchInfo) {
        searchInfo.classList.remove('visible', 'no-results');
    }
    
    searchResults = [];
    currentSearchIndex = -1;
}

function performSearch(query) {
    const noteContent = document.getElementById('viewNoteContent');
    const searchInfo = document.getElementById('searchInfo');
    
    if (!query.trim()) {
        // Restore original content if search is empty
        if (originalNoteContent) {
            noteContent.innerHTML = originalNoteContent;
        }
        searchResults = [];
        currentSearchIndex = -1;
        searchInfo.classList.remove('visible', 'no-results');
        return;
    }
    
    // Use original content as base for search
    const content = originalNoteContent || noteContent.innerHTML;
    
    // Create regex for highlighting - escape special regex characters
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const highlightedContent = content.replace(regex, '<mark class="search-highlight">$1</mark>');
    
    noteContent.innerHTML = highlightedContent;
    
    // Update search results
    searchResults = noteContent.querySelectorAll('.search-highlight');
    
    // Show search info
    if (searchResults.length > 0) {
        currentSearchIndex = 0;
        highlightCurrentResult();
        searchInfo.textContent = `Found ${searchResults.length} result${searchResults.length > 1 ? 's' : ''} for "${query}"`;
        searchInfo.classList.add('visible');
        searchInfo.classList.remove('no-results');
    } else {
        searchInfo.textContent = `No results found for "${query}"`;
        searchInfo.classList.add('visible', 'no-results');
        currentSearchIndex = -1;
    }
}

function highlightCurrentResult() {
    // Remove previous current highlight
    document.querySelectorAll('.search-highlight.current').forEach(el => {
        el.classList.remove('current');
    });
    
    if (searchResults.length > 0 && currentSearchIndex >= 0) {
        const current = searchResults[currentSearchIndex];
        current.classList.add('current');
        current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Setup search listeners - only called when modal opens
function setupSearchListeners() {
    const searchInput = document.getElementById('noteSearchInput');
    
    if (searchInput) {
        // Remove any existing listeners to prevent duplicates
        searchInput.removeEventListener('input', handleSearchInput);
        searchInput.removeEventListener('keydown', handleSearchKeydown);
        
        // Add new listeners
        searchInput.addEventListener('input', handleSearchInput);
        searchInput.addEventListener('keydown', handleSearchKeydown);
    }
}

function handleSearchInput(e) {
    performSearch(e.target.value);
}

function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults.length > 0) {
            currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
            highlightCurrentResult();
        }
    } else if (e.key === 'Escape') {
        clearSearchAndRestore();
        e.target.blur();
    }
}

// Main search handlers for notes list
function handleMainSearchInput(e) {
    renderNotes(); // Re-render notes with current search term
}

function handleMainSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        // Focus first note if any results
        const noteCards = document.querySelectorAll('.note-card');
        if (noteCards.length > 0) {
            noteCards[0].focus();
        }
    } else if (e.key === 'Escape') {
        e.target.value = '';
        e.target.blur();
        renderNotes(); // Clear search and re-render
    }
}