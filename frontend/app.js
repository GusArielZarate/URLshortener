// Configuración inicial de la URL del API Backend (EC2)
// Puedes cambiar este valor por defecto a la IP pública de tu EC2
const DEFAULT_API_URL = "http://localhost:8000";

function getApiUrl() {
  const saved = localStorage.getItem("SHORTENER_API_URL");
  return saved ? saved.replace(/\/+$/, '') : DEFAULT_API_URL;
}

function setApiUrl(url) {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  localStorage.setItem("SHORTENER_API_URL", cleanUrl);
  return cleanUrl;
}

// Inicialización de elementos del DOM
document.addEventListener("DOMContentLoaded", () => {
  const apiUrlInput = document.getElementById("apiUrlInput");
  const saveApiBtn = document.getElementById("saveApiBtn");
  const shortenForm = document.getElementById("shortenForm");
  const urlInput = document.getElementById("urlInput");
  const submitBtn = document.getElementById("submitBtn");
  const btnText = submitBtn.querySelector(".btn-text");
  const loader = submitBtn.querySelector(".loader");
  const errorAlert = document.getElementById("errorAlert");
  const errorMessage = document.getElementById("errorMessage");
  const resultBox = document.getElementById("resultBox");
  const shortUrlLink = document.getElementById("shortUrlLink");
  const copyBtn = document.getElementById("copyBtn");
  const copyBtnText = document.getElementById("copyBtnText");
  const resultShortCode = document.getElementById("resultShortCode");
  const resultOriginalUrl = document.getElementById("resultOriginalUrl");

  // Sección de consulta de enlace
  const lookupBtn = document.getElementById("lookupBtn");
  const lookupCodeInput = document.getElementById("lookupCodeInput");
  const lookupAlert = document.getElementById("lookupAlert");
  const lookupErrorMsg = document.getElementById("lookupErrorMsg");
  const lookupResult = document.getElementById("lookupResult");
  const lookupJson = document.getElementById("lookupJson");

  // Cargar URL configurada
  apiUrlInput.value = getApiUrl();

  saveApiBtn.addEventListener("click", () => {
    if (!apiUrlInput.value.trim()) {
      alert("Por favor ingresa una URL válida para el backend");
      return;
    }
    const updated = setApiUrl(apiUrlInput.value);
    apiUrlInput.value = updated;
    alert(`Backend configurado en: ${updated}`);
  });

  // Ocultar alertas
  function hideError() {
    errorAlert.classList.add("hidden");
    errorMessage.textContent = "";
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.remove("hidden");
  }

  function setLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnText.classList.add("hidden");
      loader.classList.remove("hidden");
    } else {
      submitBtn.disabled = false;
      btnText.classList.remove("hidden");
      loader.classList.add("hidden");
    }
  }

  // Manejo del formulario de acortamiento
  shortenForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    resultBox.classList.add("hidden");

    let originalUrl = urlInput.value.trim();

    // Validación en el cliente
    if (!originalUrl) {
      showError("Por favor ingresa una URL.");
      return;
    }

    if (!originalUrl.startsWith("http://") && !originalUrl.startsWith("https://")) {
      originalUrl = "https://" + originalUrl;
      urlInput.value = originalUrl;
    }

    try {
      new URL(originalUrl);
    } catch (_) {
      showError("La URL ingresada no tiene un formato válido.");
      return;
    }

    const currentApi = getApiUrl();
    setLoading(true);

    try {
      const response = await fetch(`${currentApi}/shorten`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ original_url: originalUrl })
      });

      if (!response.ok) {
        let errDetail = `Error HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData && errData.detail) {
            errDetail = errData.detail;
          }
        } catch (_) {}
        throw new Error(errDetail);
      }

      const data = await response.json();

      // Mostrar resultados
      shortUrlLink.href = data.short_url;
      shortUrlLink.textContent = data.short_url;
      resultShortCode.textContent = data.short_code;
      resultOriginalUrl.textContent = data.original_url;
      resultOriginalUrl.title = data.original_url;

      resultBox.classList.remove("hidden");

      // Limpiar input
      urlInput.value = "";
    } catch (err) {
      console.error("Error al acortar URL:", err);
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        showError(
          `No se pudo conectar con el backend en (${currentApi}). Verifica que tu instancia EC2 esté encendida, el puerto 8000 esté abierto en el Security Group y la URL del backend esté bien configurada arriba.`
        );
      } else {
        showError(err.message || "Ocurrió un error inesperado al procesar la solicitud.");
      }
    } finally {
      setLoading(false);
    }
  });

  // Botón para copiar enlace al portapapeles
  copyBtn.addEventListener("click", async () => {
    const textToCopy = shortUrlLink.textContent;
    if (!textToCopy) return;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      copyBtnText.textContent = "¡Copiado!";
      setTimeout(() => {
        copyBtnText.textContent = "Copiar";
      }, 2500);
    } catch (err) {
      console.error("No se pudo copiar:", err);
      alert("No se pudo copiar automáticamente. Puedes seleccionarlo manualmente.");
    }
  });

  // Consulta de enlace (Endpoint 3: GET /urls/{short_code})
  lookupBtn.addEventListener("click", async () => {
    lookupAlert.classList.add("hidden");
    lookupResult.classList.add("hidden");
    lookupJson.textContent = "";

    const code = lookupCodeInput.value.trim();
    if (!code) {
      lookupErrorMsg.textContent = "Por favor ingresa un UUID o código corto.";
      lookupAlert.classList.remove("hidden");
      return;
    }

    const currentApi = getApiUrl();
    try {
      const res = await fetch(`${currentApi}/urls/${code}`);
      if (res.status === 404) {
        throw new Error("404 Not Found: El enlace no existe en DynamoDB.");
      }
      if (!res.ok) {
        throw new Error(`Error HTTP ${res.status}`);
      }
      const data = await res.json();
      lookupJson.textContent = JSON.stringify(data, null, 2);
      lookupResult.classList.remove("hidden");
    } catch (err) {
      lookupErrorMsg.textContent = err.message || "Error al consultar enlace";
      lookupAlert.classList.remove("hidden");
    }
  });
});
