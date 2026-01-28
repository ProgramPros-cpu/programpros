import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signInAnonymously, 
    signOut, 
    onAuthStateChanged, 
    signInWithCustomToken 
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    serverTimestamp, 
    deleteDoc, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// --- Configuration ---
// IMPORTANT: This placeholder is replaced by Netlify at build time via netlify.toml
const GEMINI_API_KEY = "PASTE_YOUR_API_KEY_HERE"; 
const MODEL_NAME = "gemini-2.5-flash";

// Firebase Config
let firebaseConfig = {
    apiKey: "AIzaSyCVLd_TvLribvwjDVb2VBe5ga3RMsacdI8",
    authDomain: "tornadoai.firebaseapp.com",
    projectId: "tornadoai",
    storageBucket: "tornadoai.firebasestorage.app",
    messagingSenderId: "8117878637",
    appId: "1:8117878637:web:2d8bd10e053cb66f3e6464",
    measurementId: "G-K5YTTRBQ11"
};

// Handle potential environment overrides (Internal use only)
let appId = 'default-app-id';
if (typeof __firebase_config !== 'undefined') {
    try { firebaseConfig = JSON.parse(__firebase_config); } catch(e) {}
}
if (typeof __app_id !== 'undefined') { appId = __app_id; }

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- State ---
let currentUser = null;
let messages = [];
let isDarkMode = false;
let isLoading = false;
let unsubscribeChats = null;

// --- Elements ---
const els = {
    loadingScreen: document.getElementById('loading-screen'),
    loginScreen: document.getElementById('login-screen'),
    appScreen: document.getElementById('app-screen'),
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebar-overlay'),
    chatContainer: document.getElementById('chat-container'),
    messagesList: document.getElementById('messages-list'),
    welcomeState: document.getElementById('welcome-state'),
    typingIndicator: document.getElementById('typing-indicator'),
    userInput: document.getElementById('user-input'),
    btnSend: document.getElementById('btn-send'),
    btnLoginGoogle: document.getElementById('btn-login-google'),
    btnLoginGuest: document.getElementById('btn-login-guest'),
    btnSignOut: document.getElementById('btn-signout'),
    btnToggleTheme: document.getElementById('btn-toggle-theme'),
    btnClearChat: document.getElementById('btn-clear-chat'),
    btnRefreshChat: document.getElementById('btn-refresh-chat'),
    btnOpenSidebar: document.getElementById('btn-open-sidebar'),
    btnCloseSidebar: document.getElementById('btn-close-sidebar'),
    userAvatar: document.getElementById('user-avatar'),
    userIcon: document.getElementById('user-icon'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    welcomeName: document.getElementById('welcome-name'),
    loginError: document.getElementById('login-error'),
    iconTheme: document.getElementById('icon-theme'),
    textTheme: document.getElementById('text-theme')
};

// --- Initialization ---
async function init() {
    lucide.createIcons();
    
    // Check System Theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        toggleTheme(true);
    }

    // Auth Listener
    onAuthStateChanged(auth, (user) => {
        currentUser = user;
        if (user) {
            showApp();
            setupFirestore(user.uid);
            updateUserProfile(user);
        } else {
            showLogin();
            if(unsubscribeChats) unsubscribeChats();
        }
        els.loadingScreen.classList.add('opacity-0', 'pointer-events-none');
    });
}

// --- Auth Functions ---
els.btnLoginGoogle.onclick = async () => {
    els.loginError.classList.add('hidden');
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
    } catch (error) {
        els.loginError.textContent = error.message;
        els.loginError.classList.remove('hidden');
    }
};

els.btnLoginGuest.onclick = async () => {
    els.loginError.classList.add('hidden');
    try {
        await signInAnonymously(auth);
    } catch (error) {
        els.loginError.textContent = error.message;
        els.loginError.classList.remove('hidden');
    }
};

els.btnSignOut.onclick = async () => {
    await signOut(auth);
    toggleSidebar(false);
};

function showApp() {
    els.loginScreen.classList.add('hidden');
    els.appScreen.classList.remove('hidden');
}

function showLogin() {
    els.loginScreen.classList.remove('hidden');
    els.appScreen.classList.add('hidden');
}

function updateUserProfile(user) {
    if (user.photoURL) {
        els.userAvatar.src = user.photoURL;
        els.userAvatar.classList.remove('hidden');
        els.userIcon.classList.add('hidden');
    } else {
        els.userAvatar.classList.add('hidden');
        els.userIcon.classList.remove('hidden');
    }
    els.userName.textContent = user.displayName || "Guest User";
    els.userEmail.textContent = user.email || "Anonymous";
    els.welcomeName.textContent = user.displayName ? user.displayName.split(' ')[0] : 'Friend';
}

// --- Firestore & Chat Logic ---
function setupFirestore(uid) {
    // Note: For standard Firebase hosting, remove 'artifacts'/'appId' from path
    // Default Path: users/{uid}/chats
    // Preview Path: artifacts/{appId}/users/{uid}/chats
    const collectionPath = typeof __app_id !== 'undefined' 
        ? ['artifacts', appId, 'users', uid, 'chats'] 
        : ['users', uid, 'chats'];
        
    // Construct collection reference carefully based on environment
    let chatsRef;
    if (collectionPath.length > 3) {
        chatsRef = collection(db, ...collectionPath);
    } else {
        chatsRef = collection(db, 'users', uid, 'chats');
    }

    const q = query(chatsRef, orderBy('timestamp', 'asc'));

    unsubscribeChats = onSnapshot(q, (snapshot) => {
        messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMessages();
    });
}

async function handleSendMessage() {
    const text = els.userInput.value.trim();
    if (!text || isLoading || !currentUser) return;

    els.userInput.value = '';
    els.userInput.style.height = 'auto';
    updateSendButtonState();
    setIsLoading(true);

    els.typingIndicator.classList.remove('hidden');
    scrollToBottom();

    // Determine collection path again
    const collectionPath = typeof __app_id !== 'undefined' 
        ? ['artifacts', appId, 'users', currentUser.uid, 'chats'] 
        : ['users', currentUser.uid, 'chats'];
    
    let chatsRef;
    if (collectionPath.length > 3) {
        chatsRef = collection(db, ...collectionPath);
    } else {
        chatsRef = collection(db, 'users', currentUser.uid, 'chats');
    }
    
    try {
        // User Message
        await addDoc(chatsRef, {
            text: text,
            isUser: true,
            timestamp: serverTimestamp()
        });

        // Logic for response
        const override = checkIdentityOverrides(text);
        let responseText = "";

        if (override) {
            await new Promise(r => setTimeout(r, 600));
            responseText = override;
        } else {
            responseText = await callGeminiAPI(text);
        }

        // AI Message
        await addDoc(chatsRef, {
            text: responseText,
            isUser: false,
            timestamp: serverTimestamp()
        });

    } catch (err) {
        console.error("Chat error", err);
        alert("Failed to send message.");
    } finally {
        setIsLoading(false);
        els.typingIndicator.classList.add('hidden');
    }
}

function setIsLoading(loading) {
    isLoading = loading;
    els.userInput.disabled = loading;
}

function renderMessages() {
    els.messagesList.innerHTML = '';
    
    if (messages.length === 0) {
        els.welcomeState.classList.remove('hidden');
    } else {
        els.welcomeState.classList.add('hidden');
        messages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `flex gap-4 ${msg.isUser ? 'justify-end' : 'justify-start'}`;
            
            let contentHtml = '';
            if (msg.isUser) {
                contentHtml = `
                    <div class="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3 shadow-sm bg-[#1a73e8] dark:bg-[#8ab4f8] text-white dark:text-[#001d35] rounded-tr-sm">
                        <p class="whitespace-pre-wrap">${escapeHtml(msg.text)}</p>
                    </div>
                `;
            } else {
                contentHtml = `
                    <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex-shrink-0 flex items-center justify-center mt-1">
                        <i data-lucide="bot" class="w-4 h-4 text-white"></i>
                    </div>
                    <div class="max-w-[85%] md:max-w-[75%] rounded-2xl px-5 py-3 shadow-sm bg-white dark:bg-[#1e1f20] border border-gray-100 dark:border-gray-800 rounded-tl-sm text-gray-800 dark:text-gray-200 markdown-body">
                        ${parseMarkdown(msg.text)}
                        <div class="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex gap-2">
                            <button onclick="window.copyText('${escapeHtml(msg.text)}')" class="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1 transition-colors">
                                <i data-lucide="copy" class="w-3 h-3"></i> Copy
                            </button>
                        </div>
                    </div>
                `;
            }
            div.innerHTML = contentHtml;
            els.messagesList.appendChild(div);
        });
        lucide.createIcons();
        scrollToBottom();
    }
}

// --- Gemini API ---
const SYSTEM_INSTRUCTION = `You are Tornado AI, an advanced AI assistant created by Joy Kumbhakar.
    CRITICAL FORMATTING INSTRUCTIONS:
    1. Use **Markdown** for all responses.
    2. Format code blocks: \`\`\`language\\ncode\\n\`\`\`
    3. Use tables with Markdown syntax.
    4. Keep responses clean, well-structured, and professional.
    If asked about your identity, verify you are Tornado AI created by Joy Kumbhakar.`;

async function callGeminiAPI(prompt) {
    try {
        // Get context (last 5 messages)
        const context = messages.slice(-5).map(m => ({
            role: m.isUser ? "user" : "model",
            parts: [{ text: m.text }]
        }));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        ...context,
                        { role: "user", parts: [{ text: prompt }] }
                    ],
                    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
                    generationConfig: {
                        temperature: 0.8,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                })
            }
        );
        
        if (!response.ok) throw new Error("API Failed");
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

    } catch (e) {
        console.error(e);
        return "⚠️ Error: Unable to connect to Tornado AI services.";
    }
}

// --- Utilities ---

function checkIdentityOverrides(text) {
    const lower = text.toLowerCase();
    if (lower.includes("jagabandhu pal")) return "**জায়গা বন্ধু পাল** হন **জয় কুম্ভকারের মামা**।";
    if (lower.includes("shobha pal")) return "**শোভা পাল** হন **জয় কুম্ভকারের মামি**।";
    if (lower.includes("protima pal")) return "**প্রতিমা পাল** হন **জয় কুম্ভকারের মাসি**।";
    if (lower.includes("rinku pal")) return "**রিঙ্কু পাল** হন **জয় কুম্ভকারের মেসো**।";
    if (lower.includes("makhan")) return "**মাখন** হন **জয় কুম্ভকারের দাদা**।";
    if (lower.includes("tumpa")) return "**টুম্পা** হন **জয় কুম্ভকারের মা**।";
    if (lower.includes("bholanath")) return "**ভোলানাথ** হন **জয় কুম্ভকারের বাবা**।";
    if (lower.includes("puja kumbhakar")) return "**পূজা কুম্ভকার** হন **জয় কুম্ভকারের বোন**।";
    if (lower.includes("kishore")) return "**কিশোর** হন **জয় কুম্ভকারের টিচার**।";
    if (lower.includes("minoti")) return "**মিনতি** হন **জয় কুম্ভকারের দিদা (মায়ের মা)**।";
    if (lower.includes("narayoni")) return "**নারায়ণী** হন **জয় কুম্ভকারের ঠাকুমা (বাবার মা)**।";
    if (lower.includes("barun")) return "**বরুন** হন **জয় কুম্ভকারের দাদু (মায়ের বাবা)**।";
    if (lower.includes("sukhamoy")) return "**সুখময়** হন **জয় কুম্ভকারের দাদু (বাবার বাবা)**।";
    if (lower.includes("kanchan paul")) return "**কাঞ্চন পাল** হন **জয় কুম্ভকারের টিচার** যিনি আমাকে তৈরি করেছেন।";
    if (lower.includes("sandip pal")) return "**সন্দীপ পাল** হন **জয়ের bhai**।";
    if (lower.includes("sourav")) return "**সৌরভ পাল** হন **জয়ের বড় দাদা**।";
    if (lower.includes("bipad")) return "**বিপদ তারণ পাল** হন **জয়ের কাকা**।";
    if (lower.includes("piyali")) return "**পিয়ালী পাল** হন **জয়ের মিষ্টি বৌদি**।";
    if (lower.includes("priya") || lower.includes("jhilik")) return "**প্রিয়া/ঝিলিক** হন **জয় কুম্ভকারেরও বোন**।";
    if (lower.includes("puja")) return "**পূজা** হন **জয়ের বোন**।";
    return null;
}

function scrollToBottom() {
    setTimeout(() => {
        els.chatContainer.scrollTop = els.chatContainer.scrollHeight;
    }, 50);
}

function toggleTheme(forceDark) {
    isDarkMode = forceDark !== undefined ? forceDark : !isDarkMode;
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
        els.textTheme.textContent = "Light Mode";
        els.iconTheme.setAttribute('data-lucide', 'sun');
    } else {
        document.documentElement.classList.remove('dark');
        els.textTheme.textContent = "Dark Mode";
        els.iconTheme.setAttribute('data-lucide', 'moon');
    }
    lucide.createIcons();
}

function toggleSidebar(show) {
    if (show) {
        els.sidebar.classList.remove('-translate-x-full');
        els.sidebarOverlay.classList.remove('hidden');
    } else {
        els.sidebar.classList.add('-translate-x-full');
        els.sidebarOverlay.classList.add('hidden');
    }
}

// Basic Markdown Parser
function parseMarkdown(text) {
    if (!text) return '';
    
    let html = text.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><div class="flex justify-between text-xs text-gray-400 mb-2 uppercase font-bold"><span>${lang || 'CODE'}</span></div><code>${escapeHtml(code.trim())}</code></pre>`;
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[\-\*]\s+(.+)$/gm, '<ul class="list-disc pl-5"><li>$1</li></ul>');
    html = html.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mt-3 mb-2">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>');

    return html.replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateSendButtonState() {
    const text = els.userInput.value.trim();
    if (text && !isLoading) {
        els.btnSend.disabled = false;
        els.btnSend.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'text-gray-400', 'cursor-not-allowed');
        els.btnSend.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'shadow-md');
    } else {
        els.btnSend.disabled = true;
        els.btnSend.classList.add('bg-gray-200', 'dark:bg-gray-700', 'text-gray-400', 'cursor-not-allowed');
        els.btnSend.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'shadow-md');
    }
}

// --- Event Listeners ---
els.userInput.addEventListener('input', () => {
    els.userInput.style.height = 'auto';
    els.userInput.style.height = els.userInput.scrollHeight + 'px';
    updateSendButtonState();
});

els.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
    }
});

els.btnSend.addEventListener('click', handleSendMessage);
els.btnToggleTheme.addEventListener('click', () => toggleTheme());
els.btnOpenSidebar.addEventListener('click', () => toggleSidebar(true));
els.btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
els.sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
els.btnClearChat.addEventListener('click', async () => {
    if(!currentUser) return;
    if(!confirm("Clear chat history?")) return;
    const chatsRef = collection(db, 'users', currentUser.uid, 'chats');
    const snapshot = await getDocs(chatsRef);
    snapshot.forEach(doc => deleteDoc(doc.ref));
    toggleSidebar(false);
});
els.btnRefreshChat.addEventListener('click', () => els.btnClearChat.click());

window.setPrompt = (text) => {
    els.userInput.value = text;
    updateSendButtonState();
    els.userInput.focus();
};

window.copyText = (text) => {
    navigator.clipboard.writeText(text);
};

// Start
init();
