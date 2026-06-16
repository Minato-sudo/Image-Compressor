// auth.js - Supabase Authentication and Freemium Gating

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase Client
// This will throw an error until you provide valid URL and Key,
// so we'll gracefully handle it and fall back to local mode.
let supabaseClient = null;
try {
    if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && typeof supabase !== 'undefined') {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
} catch (e) {
    console.warn("Supabase not configured. Auth features will be simulated or disabled.", e);
}

const Auth = {
    user: null,
    maxFreeTries: 5,
    isSignUpMode: false,

    async init() {
        this.bindEvents();
        
        if (supabaseClient) {
            // Check active session
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                this.user = session.user;
            }

            // Listen to auth state changes
            supabaseClient.auth.onAuthStateChange((_event, session) => {
                this.user = session ? session.user : null;
                this.updateUI();
            });
        }
        
        this.updateUI();
    },

    bindEvents() {
        const btnLoginModal = document.getElementById('btn-login-modal');
        const modal = document.getElementById('auth-modal');
        const btnClose = document.getElementById('btn-close-auth');
        const toggleLink = document.getElementById('auth-toggle-link');
        const form = document.getElementById('auth-form');

        if (btnLoginModal) {
            btnLoginModal.addEventListener('click', () => {
                if (this.user) {
                    this.signOut();
                } else {
                    this.showModal();
                }
            });
        }

        if (btnClose) btnClose.addEventListener('click', () => this.hideModal());
        
        // Close modal when clicking outside
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal();
            });
        }

        if (toggleLink) {
            toggleLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.isSignUpMode = !this.isSignUpMode;
                this.updateModalUI();
            });
        }

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('auth-email').value;
                const password = document.getElementById('auth-password').value;
                await this.handleAuthSubmit(email, password);
            });
        }
    },

    getFreeTriesUsed() {
        const tries = localStorage.getItem('compressit_free_tries');
        return tries ? parseInt(tries, 10) : 0;
    },

    incrementFreeTries(count = 1) {
        if (this.user) return; // Don't count if logged in
        const current = this.getFreeTriesUsed();
        localStorage.setItem('compressit_free_tries', current + count);
        this.updateUI();
    },

    canCompress(count = 1) {
        if (this.user) return true; // Unlimited for logged in users
        
        const current = this.getFreeTriesUsed();
        if (current + count <= this.maxFreeTries) {
            return true;
        }
        
        // Exceeded tries, show modal
        this.isSignUpMode = true;
        this.updateModalUI();
        this.showModal();
        this.showError("You've reached your 5 free compressions! Please sign up to compress unlimited images.");
        return false;
    },

    updateUI() {
        const counterEl = document.getElementById('free-tries-counter');
        const loginBtn = document.getElementById('btn-login-modal');

        if (this.user) {
            if (counterEl) counterEl.textContent = `Logged in as ${this.user.email}`;
            if (loginBtn) loginBtn.textContent = 'Sign Out';
        } else {
            const used = this.getFreeTriesUsed();
            const left = Math.max(0, this.maxFreeTries - used);
            if (counterEl) counterEl.textContent = `${left} free tries left`;
            if (loginBtn) loginBtn.textContent = 'Log In / Sign Up';
        }
    },

    updateModalUI() {
        const title = document.getElementById('auth-title');
        const submitBtn = document.getElementById('btn-auth-submit');
        const toggleText = document.getElementById('auth-toggle-text');
        const toggleLink = document.getElementById('auth-toggle-link');
        const errorEl = document.getElementById('auth-error');

        if (errorEl) errorEl.style.display = 'none';

        if (this.isSignUpMode) {
            title.textContent = 'Create Account';
            submitBtn.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleLink.textContent = 'Log in';
        } else {
            title.textContent = 'Log In';
            submitBtn.textContent = 'Log In';
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = 'Sign up';
        }
    },

    showModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.style.display = 'block';
    },

    hideModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.style.display = 'none';
        const errorEl = document.getElementById('auth-error');
        if (errorEl) errorEl.style.display = 'none';
    },

    showError(msg) {
        const errorEl = document.getElementById('auth-error');
        if (errorEl) {
            errorEl.textContent = msg;
            errorEl.style.display = 'block';
        }
    },

    async handleAuthSubmit(email, password) {
        if (!supabaseClient) {
            this.showError("Supabase is not configured. Please add your URL and Key in js/auth.js.");
            return;
        }

        try {
            let error;
            if (this.isSignUpMode) {
                const res = await supabaseClient.auth.signUp({ email, password });
                error = res.error;
                if (!error && res.data.user && !res.data.session) {
                    this.showError("Check your email for the confirmation link.");
                    return;
                }
            } else {
                const res = await supabaseClient.auth.signInWithPassword({ email, password });
                error = res.error;
            }

            if (error) {
                this.showError(error.message);
            } else {
                this.hideModal();
                this.updateUI();
            }
        } catch (err) {
            this.showError("An unexpected error occurred.");
            console.error(err);
        }
    },

    async signOut() {
        if (!supabaseClient) return;
        await supabaseClient.auth.signOut();
        this.updateUI();
    }
};

// Initialize Auth on DOM load
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
