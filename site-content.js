(() => {
  const config = window.EDGE_CMS_CONFIG || {};
  const api = window.supabase;
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  const safeUrl = (value) => {
    try {
      const url = new URL(String(value || ""), window.location.href);
      return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  };
  const slidesFor = (story) => Array.isArray(story.carousel_slides) ? story.carousel_slides.map(safeUrl).filter(Boolean) : [];
  const articleHref = (story) => `article-page.html?slug=${encodeURIComponent(story.slug || "")}`;
  const formatLabel = (story) => ({ carousel: "CAROUSEL + BLOG", video: "VIDEO + BLOG" }[story.format] || "ARTICLE");
  let client;

  function getClient() {
    if (!api?.createClient || !config.supabaseUrl || !config.supabasePublishableKey) return null;
    if (!client) client = api.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
    return client;
  }

  async function getPublishedStories(limit = 30) {
    const supabase = getClient();
    if (!supabase) return [];
    const { data, error } = await supabase.from("edge_articles")
      .select("id,title,slug,category,format,author_name,excerpt,body,image_url,video_url,carousel_slides,seo_title,seo_description,published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  }

  function homeCard(story, index) {
    const href = escapeHtml(articleHref(story));
    const title = escapeHtml(story.title);
    const category = escapeHtml(story.category || "EDGE");
    const excerpt = escapeHtml(story.excerpt || "Read the latest idea from EDGE.");
    const cover = safeUrl(story.image_url) || slidesFor(story)[0];
    const visual = cover
      ? `<div class="story-art live-story-art"><img src="${escapeHtml(cover)}" alt="${title}" loading="lazy"></div>`
      : `<div class="story-art story-art-blue live-story-art" aria-hidden="true"><span class="story-art-word">EDGE<br>IDEAS.</span></div>`;
    return `<article class="story-card"><a class="story-art-link" href="${href}" aria-label="Read ${title}">${visual}<span class="live-story-index">${String(index + 1).padStart(2, "0")}</span></a><div class="story-copy"><div class="story-meta"><span>${category}</span><span class="sample-tag">${escapeHtml(formatLabel(story))}</span></div><h3><a class="story-title-link" href="${href}">${title}</a></h3><p>${excerpt}</p><a class="story-read-link" href="${href}">Read the story <span aria-hidden="true">↗</span></a></div></article>`;
  }

  function carouselMarkup(story, variant = "") {
    const slides = slidesFor(story);
    if (slides.length < 2) return "";
    const title = escapeHtml(story.title);
    const dots = slides.map((_, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" aria-label="Show image ${index + 1} of ${slides.length}" aria-current="${index === 0}"></button>`).join("");
    const figures = slides.map((url, index) => `<figure class="latest-slide latest-dynamic-slide" aria-roledescription="slide" aria-label="Image ${index + 1} of ${slides.length}"><img src="${escapeHtml(url)}" alt="${title} — image ${index + 1} of ${slides.length}" loading="${index === 0 ? "eager" : "lazy"}"><figcaption>${String(index + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}</figcaption></figure>`).join("");
    return `<div class="latest-carousel-wrap ${variant}" data-edge-carousel><div class="latest-media latest-carousel" role="region" aria-roledescription="carousel" aria-label="${title}" tabindex="0">${figures}</div><button class="latest-carousel-arrow latest-carousel-previous" type="button" aria-label="Previous image" disabled>‹</button><button class="latest-carousel-arrow latest-carousel-next" type="button" aria-label="Next image" ${slides.length < 2 ? "disabled" : ""}>›</button><div class="latest-carousel-dots" role="group" aria-label="Choose a carousel image">${dots}</div></div>`;
  }

  function latestMedia(story) {
    if (story.format === "carousel" && slidesFor(story).length > 1) return carouselMarkup(story);
    const cover = safeUrl(story.image_url) || slidesFor(story)[0];
    if (cover) return `<div class="latest-media latest-live-cover"><img src="${escapeHtml(cover)}" alt="${escapeHtml(story.title)}" loading="lazy"></div>`;
    const video = safeUrl(story.video_url);
    if (video) return `<a class="latest-media latest-video-art latest-live-video" href="${escapeHtml(video)}" target="_blank" rel="noopener noreferrer" aria-label="Watch ${escapeHtml(story.title)}"><span class="latest-media-kicker">VIDEO / EDGE</span><span class="latest-video-symbol" aria-hidden="true">▶</span><strong>WATCH<br>THE IDEA.</strong><span class="latest-media-caption">OPEN VIDEO ↗</span></a>`;
    return `<div class="latest-media latest-video-art" role="img" aria-label="EDGE story artwork"><span class="latest-media-kicker">EDGE / ${escapeHtml(story.category || "STORY")}</span><strong>IDEAS<br>IN VIEW.</strong></div>`;
  }

  function latestStory(story) {
    const href = escapeHtml(articleHref(story));
    const title = escapeHtml(story.title);
    const category = escapeHtml(story.category || "EDGE");
    const excerpt = escapeHtml(story.excerpt || "Read the full story for more.");
    const video = safeUrl(story.video_url);
    const videoLink = video ? `<a class="latest-text-link" href="${escapeHtml(video)}" target="_blank" rel="noopener noreferrer">Watch the video ↗</a>` : "";
    const carouselNote = story.format === "carousel" && slidesFor(story).length > 1 ? `<p class="latest-carousel-hint">Swipe the images or use the arrows and dots to explore.</p>` : "";
    return `<article class="latest-feature cms-story ${story.format === "carousel" ? "latest-feature-carousel" : ""}">${latestMedia(story)}<div class="latest-feature-copy"><p class="latest-format">${escapeHtml(formatLabel(story))}<span>${category}</span></p><h2>${title}</h2><p class="latest-summary">${excerpt}</p><div class="latest-actions"><a class="button button-primary" href="${href}">Read the full story</a>${videoLink}</div>${carouselNote}</div></article>`;
  }

  function initializeCarousels(root = document) {
    root.querySelectorAll("[data-edge-carousel]").forEach((wrap) => {
      if (wrap.dataset.carouselReady === "true") return;
      const track = wrap.querySelector(".latest-carousel");
      const slides = Array.from(track?.querySelectorAll(".latest-slide") || []);
      const previous = wrap.querySelector(".latest-carousel-previous");
      const next = wrap.querySelector(".latest-carousel-next");
      const dots = Array.from(wrap.querySelectorAll(".latest-carousel-dots button"));
      if (!track || slides.length < 2 || !previous || !next) return;
      wrap.dataset.carouselReady = "true";
      let activeIndex = 0;
      const showActive = (index) => {
        activeIndex = Math.max(0, Math.min(slides.length - 1, index));
        previous.disabled = activeIndex === 0;
        next.disabled = activeIndex === slides.length - 1;
        dots.forEach((dot, dotIndex) => {
          const active = dotIndex === activeIndex;
          dot.classList.toggle("is-active", active);
          dot.setAttribute("aria-current", String(active));
        });
      };
      const goTo = (index) => {
        const target = Math.max(0, Math.min(slides.length - 1, index));
        track.scrollTo({ left: target * track.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
        showActive(target);
      };
      previous.addEventListener("click", () => goTo(activeIndex - 1));
      next.addEventListener("click", () => goTo(activeIndex + 1));
      dots.forEach((dot, index) => dot.addEventListener("click", () => goTo(index)));
      track.addEventListener("scroll", () => showActive(Math.round(track.scrollLeft / Math.max(1, track.clientWidth))), { passive: true });
      track.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") { event.preventDefault(); goTo(activeIndex - 1); }
        if (event.key === "ArrowRight") { event.preventDefault(); goTo(activeIndex + 1); }
      });
      window.addEventListener("resize", () => goTo(activeIndex));
      showActive(0);
    });
  }

  async function loadHome() {
    const grid = document.querySelector("#latest-story-grid");
    if (!grid) return;
    try {
      const stories = await getPublishedStories(3);
      if (!stories.length) return;
      grid.innerHTML = stories.map(homeCard).join("");
      const note = document.querySelector("#latest .section-note");
      if (note) note.textContent = "The newest stories, published from the EDGE Editorial Desk.";
    } catch (error) {
      console.warn("EDGE live stories could not be loaded.", error);
    }
  }

  async function loadLatest() {
    const feed = document.querySelector(".latest-feed");
    const firstExample = feed?.querySelector(":scope > .latest-feature");
    if (!feed || !firstExample) return;
    const host = document.createElement("div");
    host.className = "latest-published-feed";
    host.setAttribute("aria-live", "polite");
    feed.insertBefore(host, firstExample);
    try {
      const stories = await getPublishedStories(30);
      if (!stories.length) return;
      host.innerHTML = stories.map(latestStory).join("");
      feed.querySelectorAll(":scope > .latest-feature:not(.cms-story)").forEach((example) => { example.hidden = true; });
      const reading = document.querySelector(".latest-reading");
      if (reading) reading.hidden = true;
      const note = feed.querySelector(".section-note");
      if (note) note.textContent = "Stories published from the EDGE Editorial Desk.";
      initializeCarousels(host);
    } catch (error) {
      host.innerHTML = '<p class="latest-feed-message" role="status">Live stories could not be loaded. Check the EDGE Supabase setup and try again.</p>';
      console.warn("EDGE latest feed could not be loaded.", error);
    }
  }

  function formatDate(dateString) {
    if (!dateString) return "Recently published";
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? "Recently published" : new Intl.DateTimeFormat(undefined, { year: "numeric", month: "long", day: "numeric" }).format(date);
  }

  function renderArticleBody(story) {
    const body = String(story.body || "").trim();
    const paragraphs = body.split(/\r?\n\s*\r?\n/).map((part) => part.trim()).filter(Boolean);
    const excerpt = String(story.excerpt || "").trim();
    const rest = paragraphs.filter((paragraph, index) => !(index === 0 && excerpt && paragraph === excerpt));
    return `${excerpt ? `<p class="article-lead">${escapeHtml(excerpt)}</p>` : ""}${rest.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`).join("")}${excerpt ? `<div class="article-takeaway"><p class="eyebrow">The EDGE takeaway</p><p>${escapeHtml(excerpt)}</p></div>` : ""}`;
  }

  function renderRelatedStories(story, allStories) {
    const sidebar = document.querySelector(".article-sidebar");
    if (!sidebar) return;
    const related = allStories.filter((item) => item.id !== story.id && item.category === story.category).slice(0, 3);
    if (!related.length) return;
    const heading = sidebar.querySelector(".related-heading");
    const note = sidebar.querySelector(".article-sidebar-note");
    const cards = related.map((item) => {
      const image = safeUrl(item.image_url) || slidesFor(item)[0];
      const thumb = image ? `<img class="related-live-thumb" src="${escapeHtml(image)}" alt="" loading="lazy">` : `<span class="related-art related-art-plan" aria-hidden="true"><span>EDGE / STORY</span></span>`;
      return `<a class="related-card" href="${escapeHtml(articleHref(item))}">${thumb}<span class="related-copy"><span class="related-category">${escapeHtml(item.category || "EDGE")}</span><strong>${escapeHtml(item.title)}</strong><span class="related-read">Read the story ↗</span></span></a>`;
    }).join("");
    sidebar.innerHTML = `${heading ? heading.outerHTML : ""}${cards}${note ? note.outerHTML : ""}`;
  }

  async function loadArticle() {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug || !document.querySelector(".article-main")) return;
    try {
      const supabase = getClient();
      if (!supabase) return;
      const { data: story, error } = await supabase.from("edge_articles").select("id,title,slug,category,format,author_name,excerpt,body,image_url,video_url,carousel_slides,seo_title,seo_description,published_at").eq("slug", slug).eq("status", "published").maybeSingle();
      if (error) throw error;
      if (!story) {
        const title = document.querySelector("#article-title");
        if (title) title.textContent = "Story not found";
        const deck = document.querySelector(".article-deck");
        if (deck) deck.textContent = "This story may have been unpublished or the link may be incorrect.";
        return;
      }
      const title = escapeHtml(story.title);
      const category = escapeHtml(story.category || "EDGE");
      const format = escapeHtml(formatLabel(story));
      document.title = `${story.seo_title || story.title} · EDGE`;
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = story.seo_description || story.excerpt || "Read the latest story from EDGE.";
      const eyebrow = document.querySelector(".article-heading .eyebrow");
      if (eyebrow) eyebrow.innerHTML = `<span class="eyebrow-dot"></span>${category}<span class="article-format-label">${format}</span>`;
      const titleNode = document.querySelector("#article-title");
      if (titleNode) titleNode.innerHTML = title;
      const deck = document.querySelector(".article-deck");
      if (deck) deck.textContent = story.excerpt || "";
      const byline = document.querySelector(".article-byline");
      if (byline) {
        const author = byline.querySelector("span:first-child");
        const date = byline.querySelector("time");
        if (author) author.textContent = `By ${story.author_name || "EDGE Editorial"}`;
        if (date) { date.dateTime = story.published_at || ""; date.textContent = formatDate(story.published_at); }
      }
      const crumb = document.querySelector('.article-breadcrumb [aria-current="page"]');
      if (crumb) crumb.textContent = story.title;
      const categoryLink = document.querySelector(".article-breadcrumb a:nth-of-type(2)");
      if (categoryLink) categoryLink.textContent = story.category || "EDGE";
      const hero = document.querySelector(".article-hero-art");
      if (hero) {
        const carousel = story.format === "carousel" ? carouselMarkup(story, "article-live-carousel") : "";
        const cover = safeUrl(story.image_url) || slidesFor(story)[0];
        if (carousel) hero.outerHTML = carousel;
        else if (cover) hero.outerHTML = `<figure class="article-live-cover"><img src="${escapeHtml(cover)}" alt="${title}" loading="eager"><figcaption>${title}</figcaption></figure>`;
      }
      const articleBody = document.querySelector(".article-body");
      if (articleBody) articleBody.innerHTML = renderArticleBody(story);
      const returnLink = document.querySelector(".article-return");
      if (returnLink) returnLink.href = "latest-page.html";
      renderRelatedStories(story, await getPublishedStories(100));
      initializeCarousels(document);
    } catch (error) {
      console.warn("EDGE story could not be loaded.", error);
    }
  }

  if (document.querySelector("#latest-story-grid")) void loadHome();
  if (document.querySelector(".latest-feed")) void loadLatest();
  if (new URLSearchParams(window.location.search).has("slug")) void loadArticle();
})();
