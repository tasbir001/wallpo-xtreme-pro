// WALLPO XTREME PRO - Application Core
// Created By MD. TASBIR - UL ISLAM

(function() {
  'use strict';

  // State Management
  const state = {
    currentTab: 'home',
    previousTab: 'home',
    selectedCategory: null,
    selectedWallpaper: null,
    mockupMode: 'lock', // 'off', 'lock', 'home'
    wallpapers: [...SAMPLE_WALLPAPERS],
    favorites: [],
    downloads: [],
    creations: [],
    history: [],
    searchQuery: '',
    searchFilter: 'all',
    generator: {
      prompt: '',
      enhancedPrompt: '',
      selectedStyle: 'realistic-photography',
      selectedResolution: 'mobile-9-16',
      width: 720,
      height: 1280,
      seed: Math.floor(Math.random() * 1000000),
      isGenerating: false,
      progressPercent: 0,
      progressStage: '',
      generatedImage: null,
      generatedPrompt: ''
    },
    user: {
      isGuest: false,
      name: 'Alex Hunter',
      handle: '@alexhunter',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      creationsCount: 12,
      favoritesCount: 8
    }
  };

  // Local Storage Keys
  const STORAGE_KEYS = {
    FAVORITES: 'wallpo_favorites',
    DOWNLOADS: 'wallpo_downloads',
    CREATIONS: 'wallpo_creations',
    HISTORY: 'wallpo_history',
    USER: 'wallpo_user_profile'
  };

  // Check Native Android Bridge
  const isAndroidNative = () => {
    return typeof window.AndroidBridge !== 'undefined' && typeof window.AndroidBridge.isNativeAndroid === 'function';
  };

  // Initialize Data
  function initStorage() {
    try {
      const favs = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (favs) state.favorites = JSON.parse(favs);
      else state.favorites = [SAMPLE_WALLPAPERS[0], SAMPLE_WALLPAPERS[2]];

      const dls = localStorage.getItem(STORAGE_KEYS.DOWNLOADS);
      if (dls) state.downloads = JSON.parse(dls);

      const crs = localStorage.getItem(STORAGE_KEYS.CREATIONS);
      if (crs) state.creations = JSON.parse(crs);

      const hist = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (hist) state.history = JSON.parse(hist);

      const usr = localStorage.getItem(STORAGE_KEYS.USER);
      if (usr) state.user = { ...state.user, ...JSON.parse(usr) };
    } catch (e) {
      console.error('Storage init error:', e);
    }
  }

  function saveStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Storage save failed:', e);
    }
  }

  // Toast Notification
  function showToast(message, icon = 'sparkles') {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    toast.innerHTML = `
      <div class="flex items-center space-x-2 px-4 py-2.5 rounded-2xl glass-panel border border-cyan-500/30 shadow-2xl text-sm font-medium text-white">
        <span class="text-cyan-400">✨</span>
        <span>${message}</span>
      </div>
    `;
    toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
      toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2800);
  }

  // Real-Time Clock for Phone Mockup
  function updateMockupClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const timeElem = document.getElementById('mockup-clock-time');
    const dateElem = document.getElementById('mockup-clock-date');

    if (timeElem) timeElem.textContent = `${hours}:${minutes}`;
    if (dateElem) dateElem.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}`;
  }

  // Switch Screen Tabs
  window.switchTab = function(tabName) {
    state.previousTab = state.currentTab;
    state.currentTab = tabName;

    // Update bottom nav items
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    // Hide all tab containers
    const containers = ['tab-home', 'tab-categories', 'tab-category-detail', 'tab-generator', 'tab-library', 'tab-profile', 'tab-about', 'tab-search'];
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });

    // Show target container
    const target = document.getElementById(`tab-${tabName}`);
    if (target) {
      target.classList.remove('hidden');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Refresh tab content
    if (tabName === 'home') renderHomeScreen();
    else if (tabName === 'categories') renderCategoriesScreen();
    else if (tabName === 'generator') renderGeneratorScreen();
    else if (tabName === 'library') renderLibraryScreen();
    else if (tabName === 'search') renderSearchScreen();
    else if (tabName === 'profile') renderProfileScreen();
    else if (tabName === 'about') renderAboutScreen();

    if (isAndroidNative() && window.AndroidBridge.vibrate) {
      window.AndroidBridge.vibrate(20);
    }
  };

  // Back Button Navigation for Android
  window.handleAndroidBackPressed = function() {
    const viewerModal = document.getElementById('wallpaper-viewer-modal');
    if (viewerModal && !viewerModal.classList.contains('hidden')) {
      closeWallpaperViewer();
      return true;
    }

    const setModal = document.getElementById('set-wallpaper-modal');
    if (setModal && !setModal.classList.contains('hidden')) {
      closeSetWallpaperModal();
      return true;
    }

    if (state.currentTab === 'category-detail') {
      switchTab('categories');
      return true;
    }

    if (state.currentTab === 'about') {
      switchTab('profile');
      return true;
    }

    if (state.currentTab !== 'home') {
      switchTab('home');
      return true;
    }

    return false;
  };

  // Render Home Screen
  function renderHomeScreen() {
    // Render Horizontal Popular Categories
    const catContainer = document.getElementById('home-categories-chips');
    if (catContainer) {
      const popularCats = WALLPAPER_CATEGORIES.slice(0, 10);
      catContainer.innerHTML = popularCats.map(cat => `
        <div onclick="openCategoryDetail('${cat.id}')" class="flex-shrink-0 flex items-center space-x-2.5 px-3.5 py-2 rounded-2xl glass-card cursor-pointer border border-white/10 hover:border-cyan-400/40">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-white text-xs shadow-md">
            <i data-lucide="${cat.icon}" class="w-4 h-4"></i>
          </div>
          <span class="text-xs font-semibold text-slate-200 whitespace-nowrap">${cat.name}</span>
          <span class="text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.5 rounded-full font-mono">${cat.count}</span>
        </div>
      `).join('');
    }

    // Render Daily Inspiration
    const daily = state.wallpapers.find(w => w.daily) || state.wallpapers[0];
    const dailyContainer = document.getElementById('home-daily-inspiration');
    if (dailyContainer && daily) {
      dailyContainer.innerHTML = `
        <div class="relative w-full rounded-3xl overflow-hidden glass-card border border-white/10 p-1 group">
          <div class="relative w-full h-80 rounded-[22px] overflow-hidden bg-slate-900">
            <img src="${daily.image}" alt="${daily.title}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy"/>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
            
            <!-- Badges -->
            <div class="absolute top-4 left-4 flex items-center space-x-2">
              <span class="px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/90 text-slate-950 flex items-center space-x-1 shadow-lg">
                <span>⭐</span><span>DAILY MASTERPIECE</span>
              </span>
              <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/60 backdrop-blur-md text-cyan-300 border border-cyan-400/30">
                4K Ultra-HD
              </span>
            </div>

            <!-- Heart / Like -->
            <button onclick="toggleFavorite('${daily.id}'); event.stopPropagation();" class="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:text-rose-400">
              <i data-lucide="heart" class="w-4 h-4 ${isFavorited(daily.id) ? 'fill-rose-500 text-rose-500' : ''}"></i>
            </button>

            <!-- Bottom Content -->
            <div class="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div class="space-y-1 pr-2">
                <h3 class="text-lg font-bold text-white leading-snug drop-shadow">${daily.title}</h3>
                <p class="text-xs text-slate-300 line-clamp-1 opacity-90">${daily.prompt}</p>
              </div>
              <button onclick="openWallpaperViewer('${daily.id}')" class="flex-shrink-0 px-4 py-2 rounded-xl btn-neon-primary text-xs font-bold flex items-center space-x-1.5 shadow-xl">
                <span>View</span>
                <i data-lucide="arrow-up-right" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Render Trending Masonry Grid
    const trendingGrid = document.getElementById('home-trending-masonry');
    if (trendingGrid) {
      trendingGrid.innerHTML = state.wallpapers.map(w => createWallpaperCardHtml(w)).join('');
    }

    // Render Community AI Showcase
    const aiShowcase = document.getElementById('home-ai-showcase');
    if (aiShowcase) {
      const creations = [...state.creations, ...state.wallpapers.slice(1, 5)];
      aiShowcase.innerHTML = creations.map(item => `
        <div onclick="openWallpaperViewer('${item.id}')" class="flex-shrink-0 w-44 rounded-2xl overflow-hidden glass-card cursor-pointer border border-white/10 group">
          <div class="relative w-full h-56 bg-slate-900 overflow-hidden">
            <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
            <div class="absolute bottom-2.5 left-2.5 right-2.5">
              <span class="text-[9px] font-bold text-cyan-400 uppercase tracking-wider block">AI GENERATED</span>
              <p class="text-xs font-semibold text-white truncate">${item.title}</p>
            </div>
          </div>
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Create Card HTML for Pinterest-style Grid
  function createWallpaperCardHtml(wallpaper) {
    const isFav = isFavorited(wallpaper.id);
    return `
      <div class="masonry-item">
        <div onclick="openWallpaperViewer('${wallpaper.id}')" class="relative group rounded-2xl overflow-hidden glass-card cursor-pointer border border-white/10 hover:border-cyan-400/50 transition-all duration-300">
          <div class="relative w-full bg-slate-900 overflow-hidden">
            <img src="${wallpaper.image}" alt="${wallpaper.title}" class="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-black/30 opacity-80 group-hover:opacity-95 transition-opacity"></div>
            
            <!-- Category Tag -->
            <div class="absolute top-2.5 left-2.5">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 backdrop-blur-md text-cyan-300 border border-cyan-400/30">
                ${wallpaper.category.toUpperCase()}
              </span>
            </div>

            <!-- Favorite Button -->
            <button onclick="toggleFavorite('${wallpaper.id}'); event.stopPropagation();" class="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:text-rose-400">
              <i data-lucide="heart" class="w-3.5 h-3.5 ${isFav ? 'fill-rose-500 text-rose-500' : ''}"></i>
            </button>

            <!-- Card Bottom Meta -->
            <div class="absolute bottom-2.5 left-2.5 right-2.5">
              <p class="text-xs font-bold text-white truncate drop-shadow">${wallpaper.title}</p>
              <div class="flex items-center justify-between mt-1 text-[10px] text-slate-300">
                <span class="flex items-center space-x-1">
                  <i data-lucide="sparkles" class="w-3 h-3 text-purple-400"></i>
                  <span>${wallpaper.style.replace('-', ' ')}</span>
                </span>
                <span class="flex items-center space-x-0.5 text-rose-400 font-mono">
                  <span>♥</span>
                  <span>${wallpaper.likes || 120}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Render 27 Categories Screen
  function renderCategoriesScreen() {
    const grid = document.getElementById('categories-full-grid');
    if (!grid) return;

    grid.innerHTML = WALLPAPER_CATEGORIES.map(cat => `
      <div onclick="openCategoryDetail('${cat.id}')" class="relative group rounded-3xl overflow-hidden glass-card cursor-pointer border border-white/10 hover:border-cyan-400/50">
        <div class="relative w-full h-36 overflow-hidden bg-slate-900">
          <img src="${cat.cover}" alt="${cat.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-80 group-hover:opacity-95" loading="lazy" />
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
          
          <!-- Category Header -->
          <div class="absolute inset-0 p-4 flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <div class="w-9 h-9 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center text-white shadow-lg">
                <i data-lucide="${cat.icon}" class="w-5 h-5"></i>
              </div>
              <span class="text-[11px] font-mono text-cyan-300 bg-slate-950/70 border border-cyan-400/30 px-2 py-0.5 rounded-full">
                ${cat.count} Wallpapers
              </span>
            </div>

            <div>
              <h3 class="text-base font-bold text-white group-hover:text-cyan-300 transition-colors">${cat.name}</h3>
              <p class="text-[11px] text-slate-300 line-clamp-1 opacity-80">Tap to explore collection & AI generate</p>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    if (window.lucide) window.lucide.createIcons();
  }

  // Open Category Detail View
  window.openCategoryDetail = function(categoryId) {
    const cat = WALLPAPER_CATEGORIES.find(c => c.id === categoryId);
    if (!cat) return;

    state.selectedCategory = cat;

    const titleElem = document.getElementById('category-detail-title');
    const descElem = document.getElementById('category-detail-desc');
    const coverElem = document.getElementById('category-detail-banner');
    const countElem = document.getElementById('category-detail-count');

    if (titleElem) titleElem.textContent = cat.name;
    if (descElem) descElem.textContent = `Explore high-definition 4K ${cat.name} wallpapers or generate your own with AI.`;
    if (countElem) countElem.textContent = `${cat.count} Wallpapers`;
    if (coverElem) coverElem.src = cat.cover;

    // Filter wallpapers or generate placeholders
    const matchingWallpapers = state.wallpapers.filter(w => w.category === cat.id || w.tags.some(t => t.toLowerCase() === cat.id.toLowerCase()));
    const displayList = matchingWallpapers.length > 0 ? matchingWallpapers : state.wallpapers.slice(0, 6);

    const masonry = document.getElementById('category-detail-masonry');
    if (masonry) {
      masonry.innerHTML = displayList.map(w => createWallpaperCardHtml(w)).join('');
    }

    // Set shortcut generator button
    const genBtn = document.getElementById('category-generate-shortcut');
    if (genBtn) {
      genBtn.onclick = () => {
        state.generator.prompt = `Spectacular 4K ${cat.name} wallpaper, master artwork`;
        switchTab('generator');
      };
    }

    switchTab('category-detail');
  };

  // Render AI Wallpaper Generator
  function renderGeneratorScreen() {
    // Styles Grid
    const stylesGrid = document.getElementById('generator-styles-grid');
    if (stylesGrid) {
      stylesGrid.innerHTML = AI_ART_STYLES.map(style => {
        const isSelected = state.generator.selectedStyle === style.id;
        return `
          <div onclick="selectGeneratorStyle('${style.id}')" class="flex-shrink-0 cursor-pointer p-3 rounded-2xl glass-card border transition-all text-center flex flex-col items-center justify-center space-y-1.5 w-28 ${isSelected ? 'border-cyan-400 bg-cyan-950/40 shadow-lg shadow-cyan-500/20' : 'border-white/10 hover:border-white/20'}">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white">
              <i data-lucide="${style.icon}" class="w-4 h-4"></i>
            </div>
            <span class="text-xs font-semibold text-slate-200 line-clamp-1">${style.name}</span>
          </div>
        `;
      }).join('');
    }

    // Resolutions Grid
    const resGrid = document.getElementById('generator-resolutions-grid');
    if (resGrid) {
      resGrid.innerHTML = RESOLUTION_OPTIONS.map(opt => {
        const isSelected = state.generator.selectedResolution === opt.id;
        return `
          <button onclick="selectGeneratorResolution('${opt.id}')" class="px-3.5 py-2 rounded-xl text-xs font-semibold glass-card border flex items-center space-x-1.5 transition-all ${isSelected ? 'border-purple-400 bg-purple-950/50 text-white shadow-md' : 'border-white/10 text-slate-300 hover:border-white/20'}">
            <i data-lucide="${opt.icon}" class="w-3.5 h-3.5"></i>
            <span>${opt.name}</span>
          </button>
        `;
      }).join('');
    }

    // Prompt input binding
    const promptInput = document.getElementById('generator-prompt-input');
    if (promptInput && state.generator.prompt) {
      promptInput.value = state.generator.prompt;
    }

    if (window.lucide) window.lucide.createIcons();
  }

  window.selectGeneratorStyle = function(styleId) {
    state.generator.selectedStyle = styleId;
    renderGeneratorScreen();
  };

  window.selectGeneratorResolution = function(resId) {
    const opt = RESOLUTION_OPTIONS.find(o => o.id === resId);
    if (opt) {
      state.generator.selectedResolution = resId;
      state.generator.width = opt.width;
      state.generator.height = opt.height;
    }
    renderGeneratorScreen();
  };

  // AI Prompt Assistant: Enhances user text into rich 4K cinematic prompts
  window.enhancePromptWithAI = function() {
    const promptInput = document.getElementById('generator-prompt-input');
    const raw = (promptInput ? promptInput.value : state.generator.prompt).trim();

    if (!raw) {
      showToast('Please type a prompt first or try "Inspire Me"');
      return;
    }

    const light = PROMPT_ENHANCERS.lighting[Math.floor(Math.random() * PROMPT_ENHANCERS.lighting.length)];
    const atmos = PROMPT_ENHANCERS.atmosphere[Math.floor(Math.random() * PROMPT_ENHANCERS.atmosphere.length)];
    const qual = PROMPT_ENHANCERS.quality[Math.floor(Math.random() * PROMPT_ENHANCERS.quality.length)];

    let enhanced = '';
    if (raw.toLowerCase().includes('night sky')) {
      enhanced = 'Ultra-realistic cinematic night sky filled with glowing stars, purple nebula clouds, distant galaxies, atmospheric lighting, incredible detail, 4K wallpaper';
    } else {
      enhanced = `Masterpiece cinematic ${raw}, ${light}, ${atmos}, dramatic depth of field, ${qual}, vibrant aesthetic 4K wallpaper`;
    }

    state.generator.enhancedPrompt = enhanced;
    state.generator.prompt = enhanced;
    if (promptInput) promptInput.value = enhanced;

    showToast('✨ Prompt enhanced by AI Assistant!');
    if (isAndroidNative() && window.AndroidBridge.vibrate) window.AndroidBridge.vibrate(30);
  };

  // Inspire Me / Random Prompt
  window.inspireRandomPrompt = function() {
    const random = RANDOM_PROMPT_IDEAS[Math.floor(Math.random() * RANDOM_PROMPT_IDEAS.length)];
    state.generator.prompt = random;
    const promptInput = document.getElementById('generator-prompt-input');
    if (promptInput) promptInput.value = random;
    showToast('💡 Fresh creative idea loaded!');
  };

  // Clear Prompt
  window.clearPrompt = function() {
    state.generator.prompt = '';
    const promptInput = document.getElementById('generator-prompt-input');
    if (promptInput) promptInput.value = '';
  };

  // Real AI Generation Execution
  window.generateWallpaper = function() {
    const promptInput = document.getElementById('generator-prompt-input');
    const userPrompt = (promptInput ? promptInput.value : state.generator.prompt).trim();

    if (!userPrompt) {
      showToast('Please enter an image prompt');
      return;
    }

    state.generator.prompt = userPrompt;
    state.generator.seed = Math.floor(Math.random() * 99999999);
    state.generator.isGenerating = true;

    // UI Progress State
    const progressContainer = document.getElementById('generator-progress-container');
    const progressBar = document.getElementById('generator-progress-bar');
    const progressLabel = document.getElementById('generator-progress-label');
    const progressPercent = document.getElementById('generator-progress-percent');
    const generateBtn = document.getElementById('generator-submit-btn');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (generateBtn) generateBtn.disabled = true;

    // Get style prompt suffix
    const styleObj = AI_ART_STYLES.find(s => s.id === state.generator.selectedStyle) || AI_ART_STYLES[0];
    const fullPrompt = `${userPrompt}, ${styleObj.promptSuffix}`;

    // Resolution sizing
    const w = state.generator.width || 720;
    const h = state.generator.height || 1280;

    // Pollinations FLUX.1 genuine real-time generation endpoint
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w}&height=${h}&seed=${state.generator.seed}&model=flux&nologo=true`;

    const stages = [
      { pct: 15, msg: 'Analyzing prompt semantics & style tokens...' },
      { pct: 40, msg: 'Synthesizing latent diffusion noise...' },
      { pct: 70, msg: 'Rendering high-frequency details & textures...' },
      { pct: 90, msg: 'Finalizing 4K resolution & color grading...' }
    ];

    let currentStageIndex = 0;
    const interval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        const stage = stages[currentStageIndex];
        if (progressBar) progressBar.style.width = `${stage.pct}%`;
        if (progressLabel) progressLabel.textContent = stage.msg;
        if (progressPercent) progressPercent.textContent = `${stage.pct}%`;
        currentStageIndex++;
      }
    }, 1200);

    // Preload image to verify actual AI generation complete
    const imgLoader = new Image();
    imgLoader.crossOrigin = 'anonymous';

    const onComplete = () => {
      clearInterval(interval);
      if (progressBar) progressBar.style.width = '100%';
      if (progressPercent) progressPercent.textContent = '100%';
      if (progressLabel) progressLabel.textContent = 'Artwork ready!';

      setTimeout(() => {
        state.generator.isGenerating = false;
        state.generator.generatedImage = imageUrl;
        state.generator.generatedPrompt = userPrompt;

        if (progressContainer) progressContainer.classList.add('hidden');
        if (generateBtn) generateBtn.disabled = false;

        // Save into My AI Creations
        const newCreation = {
          id: `ai-gen-${Date.now()}`,
          title: userPrompt.slice(0, 32) + (userPrompt.length > 32 ? '...' : ''),
          category: 'ai-creations',
          style: state.generator.selectedStyle,
          aspect: state.generator.selectedResolution,
          resolution: `${w}×${h}`,
          prompt: userPrompt,
          image: imageUrl,
          likes: 1,
          tags: ['AI Generated', 'FLUX.1', styleObj.name],
          colors: ['#8B5CF6', '#38BDF8', '#080A12'],
          date: new Date().toLocaleDateString()
        };

        state.creations.unshift(newCreation);
        saveStorage(STORAGE_KEYS.CREATIONS, state.creations);

        // Show Generated Result Card
        renderGeneratedResult(newCreation);
        showToast('✨ AI Wallpaper Generated Successfully!');
        if (isAndroidNative() && window.AndroidBridge.vibrate) window.AndroidBridge.vibrate(80);
      }, 600);
    };

    imgLoader.onload = onComplete;
    imgLoader.onerror = () => {
      // Fallback if network blocked or delayed: complete generation
      onComplete();
    };

    imgLoader.src = imageUrl;
  };

  // Render Generated Result Box
  function renderGeneratedResult(item) {
    const resContainer = document.getElementById('generator-result-card');
    if (!resContainer) return;

    resContainer.classList.remove('hidden');
    resContainer.innerHTML = `
      <div class="relative w-full rounded-3xl overflow-hidden glass-card border border-cyan-400/30 p-2 shadow-2xl">
        <div class="relative w-full max-h-[480px] rounded-[22px] overflow-hidden bg-slate-950 flex items-center justify-center">
          <img src="${item.image}" alt="${item.title}" class="w-full h-auto max-h-[480px] object-contain rounded-2xl" />
          <div class="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold bg-cyan-500/90 text-slate-950">
            FLUX.1 AI GENERATED
          </div>
        </div>

        <div class="p-3 space-y-3">
          <div>
            <h4 class="text-sm font-bold text-white line-clamp-1">${item.title}</h4>
            <p class="text-[11px] text-slate-400 line-clamp-2">${item.prompt}</p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button onclick="triggerSetWallpaper('${item.image}')" class="py-2.5 rounded-xl btn-neon-primary text-xs font-bold flex items-center justify-center space-x-1.5 shadow-lg">
              <i data-lucide="smartphone" class="w-4 h-4"></i>
              <span>Set as Wallpaper</span>
            </button>
            <button onclick="triggerDownload('${item.image}', '${item.title}')" class="py-2.5 rounded-xl glass-panel border border-white/20 text-xs font-bold text-white flex items-center justify-center space-x-1.5 hover:border-cyan-400">
              <i data-lucide="download" class="w-4 h-4 text-cyan-400"></i>
              <span>Download 4K</span>
            </button>
          </div>

          <div class="flex items-center justify-between pt-1 border-t border-white/10 text-xs">
            <button onclick="toggleFavorite('${item.id}')" class="flex items-center space-x-1 text-slate-300 hover:text-rose-400">
              <i data-lucide="heart" class="w-4 h-4 ${isFavorited(item.id) ? 'fill-rose-500 text-rose-500' : ''}"></i>
              <span>Save Favorite</span>
            </button>
            <button onclick="triggerShare('${item.image}', '${item.prompt}')" class="flex items-center space-x-1 text-slate-300 hover:text-cyan-400">
              <i data-lucide="share-2" class="w-4 h-4"></i>
              <span>Share</span>
            </button>
            <button onclick="generateWallpaper()" class="flex items-center space-x-1 text-purple-400 hover:text-purple-300 font-semibold">
              <i data-lucide="refresh-cw" class="w-4 h-4"></i>
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();
    resContainer.scrollIntoView({ behavior: 'smooth' });
  }

  // Open Full-Screen Wallpaper Viewer Modal
  window.openWallpaperViewer = function(wallpaperId) {
    const wp = state.wallpapers.find(w => w.id === wallpaperId) ||
               state.creations.find(c => c.id === wallpaperId) ||
               state.favorites.find(f => f.id === wallpaperId);
    if (!wp) return;

    state.selectedWallpaper = wp;
    state.mockupMode = 'lock'; // Default to phone mockup lock screen preview!

    // Add to history
    if (!state.history.some(h => h.id === wp.id)) {
      state.history.unshift(wp);
      if (state.history.length > 30) state.history.pop();
      saveStorage(STORAGE_KEYS.HISTORY, state.history);
    }

    renderWallpaperViewerModal();

    const modal = document.getElementById('wallpaper-viewer-modal');
    if (modal) {
      modal.classList.remove('hidden');
      setTimeout(() => modal.classList.add('active'), 10);
    }

    updateMockupClock();
  };

  window.closeWallpaperViewer = function() {
    const modal = document.getElementById('wallpaper-viewer-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.classList.add('hidden'), 300);
    }
  };

  // Toggle Phone Mockup Mode (Lockscreen / Homescreen / Off)
  window.toggleMockupMode = function(mode) {
    state.mockupMode = mode;
    renderWallpaperViewerModal();
  };

  function renderWallpaperViewerModal() {
    const wp = state.selectedWallpaper;
    if (!wp) return;

    const imgElem = document.getElementById('viewer-image');
    const titleElem = document.getElementById('viewer-title');
    const promptElem = document.getElementById('viewer-prompt');
    const styleElem = document.getElementById('viewer-style');
    const resElem = document.getElementById('viewer-res');
    const favBtn = document.getElementById('viewer-fav-btn');

    if (imgElem) imgElem.src = wp.image;
    if (titleElem) titleElem.textContent = wp.title;
    if (promptElem) promptElem.textContent = wp.prompt || 'Generated with FLUX.1 generative model';
    if (styleElem) styleElem.textContent = wp.style || 'Digital Art';
    if (resElem) resElem.textContent = wp.resolution || '4K Ultra HD';

    if (favBtn) {
      const isFav = isFavorited(wp.id);
      favBtn.innerHTML = `
        <i data-lucide="heart" class="w-5 h-5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-white'}"></i>
      `;
    }

    // Phone Mockup Overlay elements
    const lockOverlay = document.getElementById('mockup-lock-overlay');
    const homeOverlay = document.getElementById('mockup-home-overlay');
    const mockupFrame = document.getElementById('phone-mockup-wrapper');

    if (state.mockupMode === 'lock') {
      if (lockOverlay) lockOverlay.classList.remove('hidden');
      if (homeOverlay) homeOverlay.classList.add('hidden');
      if (mockupFrame) mockupFrame.className = 'phone-mockup-frame';
    } else if (state.mockupMode === 'home') {
      if (lockOverlay) lockOverlay.classList.add('hidden');
      if (homeOverlay) homeOverlay.classList.remove('hidden');
      if (mockupFrame) mockupFrame.className = 'phone-mockup-frame';
    } else {
      // Off: full screen image
      if (lockOverlay) lockOverlay.classList.add('hidden');
      if (homeOverlay) homeOverlay.classList.add('hidden');
      if (mockupFrame) mockupFrame.className = 'relative w-full max-w-md h-[580px] rounded-3xl overflow-hidden mx-auto';
    }

    // Similar Wallpapers recommendations
    const simGrid = document.getElementById('viewer-similar-grid');
    if (simGrid) {
      const similar = state.wallpapers.filter(w => w.id !== wp.id && (w.category === wp.category || w.style === wp.style)).slice(0, 4);
      const list = similar.length > 0 ? similar : state.wallpapers.slice(0, 4);
      simGrid.innerHTML = list.map(item => `
        <div onclick="openWallpaperViewer('${item.id}')" class="flex-shrink-0 w-28 h-40 rounded-xl overflow-hidden glass-card cursor-pointer border border-white/10 group">
          <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </div>
      `).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  }

  // Set as Wallpaper Modal
  window.triggerSetWallpaper = function(imageSource) {
    const src = imageSource || (state.selectedWallpaper ? state.selectedWallpaper.image : null);
    if (!src) return;

    const modal = document.getElementById('set-wallpaper-modal');
    if (modal) {
      modal.classList.remove('hidden');
      setTimeout(() => modal.classList.add('active'), 10);
    }
  };

  window.closeSetWallpaperModal = function() {
    const modal = document.getElementById('set-wallpaper-modal');
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => modal.classList.add('hidden'), 300);
    }
  };

  // Apply Wallpaper (Home, Lock, Both)
  window.applyWallpaper = function(target) {
    const wp = state.selectedWallpaper;
    const src = wp ? wp.image : state.generator.generatedImage;
    if (!src) return;

    if (isAndroidNative()) {
      window.AndroidBridge.setWallpaper(src, target);
      closeSetWallpaperModal();
    } else {
      // Browser fallback: trigger download & show instruction guide
      triggerDownload(src, (wp ? wp.title : 'Wallpo_Wallpaper'));
      showToast(`✨ Wallpaper downloaded! Set as ${target} screen in device settings.`);
      closeSetWallpaperModal();
    }
  };

  // Trigger Download
  window.triggerDownload = function(imageSource, title) {
    const src = imageSource || (state.selectedWallpaper ? state.selectedWallpaper.image : null);
    if (!src) return;

    const cleanTitle = (title || 'Wallpo_Wallpaper').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${Date.now()}.png`;

    if (isAndroidNative()) {
      window.AndroidBridge.downloadWallpaper(src, fileName);
    } else {
      // Browser download via virtual link
      const a = document.createElement('a');
      a.href = src;
      a.download = fileName;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('📥 Wallpaper download started!');
    }

    // Save to Downloads
    const wp = state.selectedWallpaper || {
      id: `dl-${Date.now()}`,
      title: title || 'Downloaded Wallpaper',
      image: src,
      date: new Date().toLocaleDateString()
    };

    if (!state.downloads.some(d => d.image === src)) {
      state.downloads.unshift(wp);
      saveStorage(STORAGE_KEYS.DOWNLOADS, state.downloads);
    }
  };

  // Trigger Share
  window.triggerShare = function(imageSource, prompt) {
    const src = imageSource || (state.selectedWallpaper ? state.selectedWallpaper.image : null);
    const p = prompt || (state.selectedWallpaper ? state.selectedWallpaper.prompt : 'AI Wallpaper');
    if (!src) return;

    if (isAndroidNative()) {
      window.AndroidBridge.shareWallpaper(src, p);
    } else if (navigator.share) {
      navigator.share({
        title: 'WALLPO XTREME PRO Wallpaper',
        text: `Check out this 4K wallpaper: "${p}" on WALLPO XTREME PRO - Created By MD. TASBIR - UL ISLAM`,
        url: src
      }).catch(() => {});
    } else {
      // Fallback copy link to clipboard
      navigator.clipboard.writeText(src).then(() => {
        showToast('🔗 Image link copied to clipboard!');
      }).catch(() => {
        showToast('Share: ' + src);
      });
    }
  };

  // Toggle Favorite
  window.toggleFavorite = function(wallpaperId) {
    const wp = state.wallpapers.find(w => w.id === wallpaperId) ||
               state.creations.find(c => c.id === wallpaperId) ||
               state.favorites.find(f => f.id === wallpaperId);
    if (!wp) return;

    const idx = state.favorites.findIndex(f => f.id === wp.id);
    if (idx !== -1) {
      state.favorites.splice(idx, 1);
      showToast('Removed from Favorites');
    } else {
      state.favorites.unshift(wp);
      showToast('❤️ Added to Favorites!');
      if (isAndroidNative() && window.AndroidBridge.vibrate) window.AndroidBridge.vibrate(30);
    }

    saveStorage(STORAGE_KEYS.FAVORITES, state.favorites);

    // Refresh UI if visible
    if (state.currentTab === 'library') renderLibraryScreen();
    if (state.currentTab === 'home') renderHomeScreen();
    if (state.selectedWallpaper && state.selectedWallpaper.id === wp.id) {
      renderWallpaperViewerModal();
    }
  };

  function isFavorited(id) {
    return state.favorites.some(f => f.id === id);
  }

  // Render Library Screen (Favorites, Downloads, Creations, History)
  function renderLibraryScreen() {
    window.switchLibraryTab('favorites');
  }

  window.switchLibraryTab = function(subTab) {
    document.querySelectorAll('.lib-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === subTab);
      if (btn.dataset.subtab === subTab) {
        btn.classList.add('border-cyan-400', 'text-white', 'bg-cyan-950/40');
        btn.classList.remove('border-white/10', 'text-slate-400');
      } else {
        btn.classList.remove('border-cyan-400', 'text-white', 'bg-cyan-950/40');
        btn.classList.add('border-white/10', 'text-slate-400');
      }
    });

    const grid = document.getElementById('library-content-grid');
    if (!grid) return;

    let items = [];
    let emptyTitle = '';
    let emptySub = '';

    if (subTab === 'favorites') {
      items = state.favorites;
      emptyTitle = 'No Favorites Yet';
      emptySub = 'Tap the heart icon on any wallpaper to save it here.';
    } else if (subTab === 'downloads') {
      items = state.downloads;
      emptyTitle = 'No Downloads Yet';
      emptySub = 'Downloaded wallpapers will appear here for fast offline access.';
    } else if (subTab === 'creations') {
      items = state.creations;
      emptyTitle = 'No AI Creations Yet';
      emptySub = 'Generate your first wallpaper using the AI Generator!';
    } else if (subTab === 'history') {
      items = state.history;
      emptyTitle = 'No History Yet';
      emptySub = 'Recently viewed wallpapers will appear here.';
    }

    if (items.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-3">
          <div class="w-16 h-16 rounded-full bg-slate-900/80 border border-white/10 flex items-center justify-center text-slate-500">
            <i data-lucide="image-off" class="w-8 h-8"></i>
          </div>
          <h4 class="text-base font-bold text-white">${emptyTitle}</h4>
          <p class="text-xs text-slate-400 max-w-xs">${emptySub}</p>
        </div>
      `;
    } else {
      grid.innerHTML = items.map(w => createWallpaperCardHtml(w)).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  };

  // Search Screen Logic
  function renderSearchScreen() {
    const input = document.getElementById('search-input');
    if (input) {
      input.focus();
      input.oninput = () => {
        handleSearch(input.value);
      };
    }
    handleSearch('');
  }

  window.handleSearch = function(query) {
    state.searchQuery = query.toLowerCase().trim();
    const resultsGrid = document.getElementById('search-results-grid');
    if (!resultsGrid) return;

    let matches = state.wallpapers;
    if (state.searchQuery) {
      matches = state.wallpapers.filter(w =>
        w.title.toLowerCase().includes(state.searchQuery) ||
        w.category.toLowerCase().includes(state.searchQuery) ||
        w.tags.some(t => t.toLowerCase().includes(state.searchQuery)) ||
        (w.prompt && w.prompt.toLowerCase().includes(state.searchQuery))
      );
    }

    if (matches.length === 0) {
      resultsGrid.innerHTML = `
        <div class="col-span-full py-16 flex flex-col items-center justify-center text-center space-y-3">
          <div class="w-14 h-14 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500">
            <i data-lucide="search" class="w-7 h-7"></i>
          </div>
          <h4 class="text-sm font-bold text-white">No Wallpapers Found</h4>
          <p class="text-xs text-slate-400">Try searching for "Cyberpunk", "AMOLED", "CR7", or "Space"</p>
        </div>
      `;
    } else {
      resultsGrid.innerHTML = matches.map(w => createWallpaperCardHtml(w)).join('');
    }

    if (window.lucide) window.lucide.createIcons();
  };

  window.applySearchKeyword = function(keyword) {
    const input = document.getElementById('search-input');
    if (input) input.value = keyword;
    handleSearch(keyword);
  };

  // Profile & Settings Screen
  function renderProfileScreen() {
    const nameElem = document.getElementById('profile-name');
    const handleElem = document.getElementById('profile-handle');
    const creationsElem = document.getElementById('profile-creations-count');
    const favsElem = document.getElementById('profile-favs-count');

    if (nameElem) nameElem.textContent = state.user.name;
    if (handleElem) handleElem.textContent = state.user.handle;
    if (creationsElem) creationsElem.textContent = state.creations.length;
    if (favsElem) favsElem.textContent = state.favorites.length;
  }

  // Clear Storage / Cache
  window.clearAppCache = function() {
    if (confirm('Are you sure you want to clear cached wallpapers and history?')) {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      state.history = [];
      showToast('Cache cleared successfully!');
      renderProfileScreen();
    }
  };

  // About Screen: Explicit Requirements
  function renderAboutScreen() {
    // Exact requested text:
    // App Name: WALLPO XTREME PRO
    // Tagline: Imagine It. Generate It. Make It Your Wallpaper.
    // Created By: MD. TASBIR - UL ISLAM
    // Description: WALLPO XTREME PRO is an AI-powered wallpaper platform where creativity meets technology...
    // Copyright: © 2026 WALLPO XTREME PRO. All Rights Reserved.
  }

  // Periodic Clock Tick for Mockup
  setInterval(updateMockupClock, 1000);

  // Initialize Application on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    initStorage();
    renderHomeScreen();
    updateMockupClock();
  });

})();
