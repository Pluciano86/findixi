// public/js/popupManager.js
export function showPopup({ title, message, buttons }) {
  const popup = document.createElement("div");

  popup.className = `
    fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]
  `;

  popup.innerHTML = `
    <div class="bg-white rounded-2xl p-6 w-[85%] max-w-sm text-center animate-fadeIn shadow-xl">
      <h2 class="text-xl font-semibold mb-3 text-gray-800">${title}</h2>
      <p class="text-gray-600 mb-6 leading-relaxed">${message}</p>
      <div id="popupButtons" class="flex flex-col gap-3"></div>
    </div>
  `;

  document.body.appendChild(popup);

  const btnContainer = popup.querySelector("#popupButtons");

  buttons.forEach(btn => {
    const b = document.createElement("button");

    b.className = `
      ${btn.primary ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}
      w-full py-2 rounded-xl text-sm font-medium shadow-sm
    `;

    b.innerText = btn.text;

    b.onclick = () => {
      popup.remove();
      if (btn.onClick) btn.onClick();
    };

    btnContainer.appendChild(b);
  });
}