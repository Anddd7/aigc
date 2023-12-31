document.addEventListener("DOMContentLoaded", function () {
    const promptList = document.getElementById("promptList");

    // Load and render existing prompts on first load
    loadAndRenderPrompts();

    function loadAndRenderPrompts() {
        promptList.innerHTML = "";
        chrome.storage.sync.get(["prompts"], function (result) {
            const prompts = result.prompts || [];
            prompts.forEach((prompt) => {
                addPromptToUI(prompt.id, prompt.title, prompt.content);
            });
        });
    }

    const createPromptButton = document.getElementById("createPromptButton");
    createPromptButton.addEventListener("click", function () {
        showPromptDialog();
    });

    let promptDialog = null;
    function showPromptDialog() {
        if (promptDialog) {
            return;
        }

        promptDialog = document.createElement("div");
        promptDialog.classList.add("panel", "input-panel", "prompt-dialog");
        promptDialog.innerHTML = `
        <h3>Add new Prompt</h3>
        <label for="title">Title:</label>
        <input type="text" id="title" required><br>
        <label for="content">Content:</label>
        <textarea id="content" rows="4" required></textarea><br>
        <button id="savePromptButton">Save</button>
      `;

        const savePromptButton = promptDialog.querySelector("#savePromptButton");
        savePromptButton.addEventListener("click", function () {
            const id = new Date().getTime();
            const title = promptDialog.querySelector("#title").value;
            const content = promptDialog.querySelector("#content").value;
            if (title && content) {
                savePrompt(id, title, content);
                addPromptToUI(id, title, content);
                promptDialog.remove();
                promptDialog = null;
            }
        });

        promptList.insertBefore(promptDialog, promptList.firstChild);
    }

    function savePrompt(id, title, content) {
        chrome.storage.sync.get(["prompts"], function (result) {
            const prompts = result.prompts || [];
            prompts.push({ id: id, title: title, content: content });
            chrome.storage.sync.set({ prompts: prompts }, function () {
                console.log("Prompt saved to storage.");
            });
        });
    }

    function addPromptToUI(id, title, content) {
        const promptPanel = document.createElement("div");
        promptPanel.classList.add("panel", "prompt-panel");
        promptPanel.innerHTML = `
        <h3>${title}</h3>
        <p>${content}</p>
        <button class="delete-prompt-button" data-index="${id}">X</button>
        `;

        promptPanel.addEventListener("click", function () {
            copyToClipboard(content);
        });

        const deleteButton = promptPanel.querySelector(".delete-prompt-button");
        deleteButton.addEventListener("click", function (event) {
            event.stopPropagation();
            deletePrompt(id);
            promptPanel.remove();
        });

        promptList.appendChild(promptPanel);
    }

    function deletePrompt(index) {
        chrome.storage.sync.get(["prompts"], function (result) {
            const prompts = result.prompts || [];
            prompts.splice(prompts.findIndex((prompt) => prompt.id === index), 1);
            chrome.storage.sync.set({ prompts: prompts }, function () {
                console.log("Prompt deleted from storage.");
            });
        });
    }

    function copyToClipboard(text) {
        const variablePattern = /{{(.*?)}}/g;
        const variables = text.match(variablePattern);

        if (variables && variables.length > 0) {
            const uniqueVariables = [...new Set(variables)];
            showVariableDialog(uniqueVariables, text);
        } else {
            copyText(text);
        }
    }

    let variableDialog = null;
    function showVariableDialog(variables, originalText) {
        if (!variableDialog) {
            createVariableDialog(variables, originalText);
        } else {
            updateVariableDialog(variables, originalText);
        }
    }

    function createVariableDialog(variables, originalText) {
        variableDialog = document.createElement("div");
        variableDialog.classList.add("panel", "input-panel", "variable-dialog");
        variableDialog.innerHTML = `
        <h3>Fill in Variables</h3>
        ${variables.map((variable) => `<label>${variable}: <input type="text" data-variable="${variable}"></label><br>`).join("")}
        <button id="replaceVariablesButton">Replace and Copy</button>
        `;

        const replaceVariablesButton = variableDialog.querySelector("#replaceVariablesButton");
        replaceVariablesButton.addEventListener("click", function () {
            const replacedText = replaceVariables(originalText, variableDialog);
            copyText(replacedText);
            variableDialog.remove();
            variableDialog = null;
        });

        promptList.insertBefore(variableDialog, promptList.firstChild);
    }

    function updateVariableDialog(variables, originalText) {
        // const inputContainer = variableDialog.querySelector(".variable-dialog");
        variableDialog.innerHTML = `
        <h3>Fill in Variables</h3>
        ${variables.map((variable) => `<label>${variable}: <input type="text" data-variable="${variable}"></label><br>`).join("")}
        <button id="replaceVariablesButton">Replace and Copy</button>
        `;

        const replaceVariablesButton = variableDialog.querySelector("#replaceVariablesButton");
        replaceVariablesButton.addEventListener("click", function () {
            const replacedText = replaceVariables(originalText, variableDialog);
            copyText(replacedText);
            variableDialog.remove();
            variableDialog = null;
        });
    }

    function replaceVariables(text, dialog) {
        const inputElements = dialog.querySelectorAll("input[data-variable]");
        inputElements.forEach((inputElement) => {
            const variable = inputElement.getAttribute("data-variable");
            const value = inputElement.value;
            text = text.replace(new RegExp(variable, "g"), value);
        });

        return text;
    }

    function copyText(text) {
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const tabId = tabs[0].id;
            chrome.runtime.sendMessage({ action: "copyToTextArea", text: text, tabId: tabId }, (response) => {
                if (response.success) {
                    console.log("Content copied to textarea.");
                }
            });
        });

        navigator.clipboard.writeText(text)
            .then(() => {
                console.log("Text copied to clipboard");
                console.log(text);
            })
            .catch((error) => {
                console.error("Unable to copy text: ", error);
            });
    }

    const searchInput = document.getElementById("searchInput");
    const searchButton = document.getElementById("searchButton");
    const clearSearchButton = document.getElementById("clearSearchButton");

    searchButton.addEventListener("click", function () {
        const keyword = searchInput.value.trim().toLowerCase();
        searchPrompts(keyword);
    });

    clearSearchButton.addEventListener("click", function () {
        clearSearch();
    });

    function searchPrompts(keyword) {
        chrome.storage.sync.get(["prompts"], function (result) {
            const prompts = result.prompts || [];
            const filteredPrompts = prompts.filter(prompt => {
                const lowerCaseTitle = prompt.title.toLowerCase();
                const lowerCaseContent = prompt.content.toLowerCase();
                return lowerCaseTitle.includes(keyword) || lowerCaseContent.includes(keyword);
            });
            renderPrompts(filteredPrompts);
        });
    }

    function clearSearch() {
        loadAndRenderPrompts();
        searchInput.value = "";
    }

    function renderPrompts(prompts) {
        promptList.innerHTML = "";
        prompts.forEach((prompt) => {
            addPromptToUI(prompt.id, prompt.title, prompt.content);
        });
    }

    // export prompts as json file on exportButton click
    const exportButton = document.getElementById("exportButton");
    exportButton.addEventListener("click", function () {
        chrome.storage.sync.get(["prompts"], function (result) {
            const prompts = result.prompts || [];
            const json = JSON.stringify(prompts);
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "prompt-clipboard.json";
            a.click();
            URL.revokeObjectURL(url);
        });
    });

    // import prompts from json file on importButton click
    const importButton = document.getElementById("importButton");
    importButton.addEventListener("click", function () {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "application/json";
        fileInput.addEventListener("change", function () {
            const file = fileInput.files[0];
            const reader = new FileReader();
            reader.addEventListener("load", function (event) {
                const json = event.target.result;
                const prompts = JSON.parse(json);
                chrome.storage.sync.set({ prompts: prompts }, function () {
                    console.log("Prompts imported from file.");
                    loadAndRenderPrompts();
                });
            });
            reader.readAsText(file);
        });
        fileInput.click();
    })
});
