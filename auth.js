(() => {
  const config = window.EDGE_AUTH_CONFIG || {};
  const isConfigured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  const supabaseApi = window.supabase;

  const showStatus = (element, message, state = "info") => {
    if (!element) return;
    element.textContent = message;
    element.dataset.state = state;
  };

  const configurationMessage = () => {
    if (window.location.protocol === "file:") {
      return "Open EDGE through localhost or its hosted website before connecting accounts.";
    }
    return "Authentication is not connected yet. Add the Supabase project URL and publishable key to auth-config.js.";
  };

  if (!isConfigured || !supabaseApi?.createClient) {
    document.querySelectorAll("[data-auth-status]").forEach((status) => showStatus(status, configurationMessage(), "notice"));
    document.querySelectorAll("[data-auth-form] [data-auth-trigger]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        const form = button.closest("form");
        if (form && !form.reportValidity()) return;
        const status = form?.querySelector("[data-auth-status]");
        showStatus(status, configurationMessage(), "notice");
      });
    });
    document.querySelectorAll("[data-auth-form]").forEach((form) => form.addEventListener("submit", (event) => event.preventDefault()));
    return;
  }

  const client = supabaseApi.createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const currentPageUrl = (fileName) => new URL(fileName, window.location.href).href;

  const signUpForm = document.querySelector("[data-auth-form='signup']");
  if (signUpForm) {
    const status = signUpForm.querySelector("[data-auth-status]");
    signUpForm.addEventListener("submit", (event) => event.preventDefault());
    signUpForm.querySelector("[data-auth-trigger]").addEventListener("click", async () => {
      if (!signUpForm.reportValidity()) return;

      const submit = signUpForm.querySelector("[data-auth-trigger]");
      submit.disabled = true;
      showStatus(status, "Creating your EDGE account…");

      try {
        const form = new FormData(signUpForm);
        const { data, error } = await client.auth.signUp({
          email: String(form.get("email")).trim(),
          password: String(form.get("password")),
          options: {
            emailRedirectTo: currentPageUrl("sign-in-page.html?confirmed=1"),
            data: {
              first_name: String(form.get("first-name") || "").trim(),
              last_name: String(form.get("last-name") || "").trim(),
              newsletter_opt_in: form.get("updates") === "on"
            }
          }
        });
        if (error) throw error;

        if (data.session) {
          showStatus(status, "Your account is ready and you’re signed in.", "success");
        } else {
          showStatus(status, "Check your email for a confirmation link to finish creating your account.", "success");
        }
        signUpForm.reset();
      } catch (error) {
        showStatus(status, error.message || "We couldn’t create your account. Please try again.", "error");
      } finally {
        submit.disabled = false;
      }
    });
  }

  const signInForm = document.querySelector("[data-auth-form='signin']");
  if (signInForm) {
    const status = signInForm.querySelector("[data-auth-status]");
    const signOut = signInForm.querySelector("[data-auth-signout]");

    const renderSession = async (session) => {
      if (session?.user) {
        showStatus(status, `Signed in as ${session.user.email}.`, "success");
        if (signOut) signOut.hidden = false;
      } else {
        if (signOut) signOut.hidden = true;
        const params = new URLSearchParams(window.location.search);
        if (params.get("confirmed") === "1") {
          showStatus(status, "Email confirmed. You can now sign in.", "success");
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    };

    signInForm.addEventListener("submit", (event) => event.preventDefault());
    signInForm.querySelector("[data-auth-trigger]").addEventListener("click", async () => {
      if (!signInForm.reportValidity()) return;

      const submit = signInForm.querySelector("[data-auth-trigger]");
      submit.disabled = true;
      showStatus(status, "Signing in…");

      try {
        const form = new FormData(signInForm);
        const { data, error } = await client.auth.signInWithPassword({
          email: String(form.get("email")).trim(),
          password: String(form.get("password"))
        });
        if (error) throw error;
        await renderSession(data.session);
        signInForm.reset();
      } catch (error) {
        showStatus(status, error.message || "We couldn’t sign you in. Check your details and try again.", "error");
      } finally {
        submit.disabled = false;
      }
    });

    if (signOut) {
      signOut.addEventListener("click", async () => {
        signOut.disabled = true;
        const { error } = await client.auth.signOut();
        if (error) showStatus(status, error.message || "Couldn’t sign you out. Please try again.", "error");
        else showStatus(status, "You’re signed out.", "success");
        signOut.disabled = false;
      });
    }

    client.auth.getSession().then(({ data, error }) => {
      if (error) showStatus(status, error.message, "error");
      else renderSession(data.session);
    });
    client.auth.onAuthStateChange((_event, session) => renderSession(session));
  }

  const resetRequestForm = document.querySelector("[data-auth-form='password-reset-request']");
  const resetUpdateForm = document.querySelector("[data-auth-form='password-reset-update']");
  if (resetRequestForm || resetUpdateForm) {
    const requestStatus = resetRequestForm?.querySelector("[data-auth-status]");
    const updateStatus = resetUpdateForm?.querySelector("[data-auth-status]");
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

    const showPasswordUpdate = () => {
      if (resetRequestForm) resetRequestForm.hidden = true;
      if (resetUpdateForm) resetUpdateForm.hidden = false;
      showStatus(updateStatus, "Choose a new password for your EDGE account.");
    };

    if (hashParams.get("type") === "recovery") showPasswordUpdate();
    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") showPasswordUpdate();
    });

    if (resetRequestForm) {
      resetRequestForm.addEventListener("submit", (event) => event.preventDefault());
      resetRequestForm.querySelector("[data-auth-trigger]").addEventListener("click", async () => {
        if (!resetRequestForm.reportValidity()) return;
        const button = resetRequestForm.querySelector("[data-auth-trigger]");
        button.disabled = true;
        showStatus(requestStatus, "Requesting a password reset…");
        try {
          const email = String(new FormData(resetRequestForm).get("email")).trim();
          const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: currentPageUrl("password-reset-page.html")
          });
          if (error) throw error;
          showStatus(requestStatus, "If that address has an EDGE account, a reset link will arrive shortly.", "success");
        } catch (error) {
          showStatus(requestStatus, error.message || "We couldn’t send a reset link. Please try again.", "error");
        } finally {
          button.disabled = false;
        }
      });
    }

    if (resetUpdateForm) {
      resetUpdateForm.addEventListener("submit", (event) => event.preventDefault());
      resetUpdateForm.querySelector("[data-auth-trigger]").addEventListener("click", async () => {
        if (!resetUpdateForm.reportValidity()) return;
        const form = new FormData(resetUpdateForm);
        const password = String(form.get("password"));
        if (password !== String(form.get("password-confirm"))) {
          showStatus(updateStatus, "The passwords don’t match. Please check and try again.", "error");
          return;
        }
        const button = resetUpdateForm.querySelector("[data-auth-trigger]");
        button.disabled = true;
        showStatus(updateStatus, "Updating your password…");
        try {
          const { error } = await client.auth.updateUser({ password });
          if (error) throw error;
          showStatus(updateStatus, "Your password is updated. You can now sign in.", "success");
          resetUpdateForm.reset();
        } catch (error) {
          showStatus(updateStatus, error.message || "We couldn’t update your password. Request a new reset link and try again.", "error");
        } finally {
          button.disabled = false;
        }
      });
    }
  }
})();
