class FilesStack {
    static #map = {};

    /** @param {String} id @returns {File | undefined} */
    static getFile(id) { return this.#map[id] }

    /** @returns {File[]} */
    static getFiles() { return Object.values(this.#map); }

    /** @param {String} json @returns {File[]} */
    static addFiles(json) {
        let object;
        try { object = JSON.parse(json).animations } catch { return []; }
        if (object == undefined) return [];

        const files = [];
        for (let id of Object.keys(object)) {
            if (typeof object[id] != 'object') continue;

            const file = new File(id, object[id]);
            this.#map[file.id] = file;
            files.push(file);
        }

        return files;
    }

    /** @param {String} id */
    static deleteFile(id) { delete this.#map[id]; this.updateUI(); }

    static FileCardInputPrefix = 'file_card_input_'
    static FileCardDeletePrefix = 'file_card_delete_'
    static updateUI() {
        const stackElement = document.getElementById('filesStack');

        const savedConditions = {};
        for (const file of this.getFiles()) { savedConditions[file.id] = file.molangCondition; }

        while (stackElement.firstChild) {
            stackElement.removeChild(stackElement.firstChild);
        }

        for (const file of this.getFiles()) {
            const node = document.createElement('div');

            node.className = 'file-card';
            node.innerHTML = `
                <div class="file-card-header">
                    <h3 class="file-card-text">${file.id}</h3>
                    <button class="file-card-close" onClick="FilesStack.deleteFile('${file.id}')" title="Delete">&#10006;</button>
                </div>
                <input type="text" class="file-card-input" placeholder="v.is_first_person" id="${this.FileCardInputPrefix + file.id}" ${savedConditions[file.id] ? 'value="' + savedConditions[file.id] + '"' : ''} />
            `

            stackElement.appendChild(node);
        }
    }
}

class File {
    /** @param {String} json */
    constructor(id, data) {
        this.#id = id;
        this.#data = data;
    }
    #id
    #data

    get id() { return this.#id }
    get data() { return this.#data }

    /** @type {String | undefined} */
    get molangCondition() { return document.getElementById(FilesStack.FileCardInputPrefix + this.id)?.value }

    delete() { FilesStack.deleteFile(this.id); }
}

/** @param {File} file1 @param {File} file2 @returns {Object} */
function combineAnimations(file1, file2) {
    const newAnimation = structuredClone(file1.data);

    for (let bone of Object.keys(file1.data.bones)) {
        for (let action of Object.keys(file1.data.bones[bone])) {
            const defaultValue = action == 'scale' ? 1 : 0;

            if (!Array.isArray(file1.data.bones[bone][action])) { 
                for (let time of Object.keys(file1.data.bones[bone][action])) {
                    let values1 = file1.data.bones[bone][action][time].post || file1.data.bones[bone][action][time];
                    let values2 = (((file2.data.bones[bone] || {})[action] || {})[time] || {}).post || ((file2.data.bones[bone] || {})[action] || {})[time];
                    if (values1 == undefined || values2 == undefined) continue;

                    let newValues = new Array(3).fill(0).map((_, index) => {
                        return `((${file2.molangCondition || '!(' + (file1.molangCondition || '0') + ')'}) ? (${(values2[index] ?? values2)}) : (${file1.molangCondition && file2.molangCondition ? '(' + file1.molangCondition + ') ? ' + (values1[index] ?? values1) + ' : ' + defaultValue : (values1[index] ?? values1)}))`
                    });

                    if (!Array.isArray(values1) && !Array.isArray(values2)) newValues = newValues[0];

                    if (file1.data.bones[bone][action][time].post) newAnimation.bones[bone][action][time].post = newValues;
                    else newAnimation.bones[bone][action][time] = newValues;
                };
            } else {
                let values1 = file1.data.bones[bone][action].post || file1.data.bones[bone][action];
                let values2 = ((file2.data.bones[bone] || {})[action] || {}).post || (file2.data.bones[bone] || {})[action];
                if (values1 == undefined || values2 == undefined) continue;

                let newValues = new Array(3).fill(0).map((_, index) => {
                    return `((${file2.molangCondition || '!(' + (file1.molangCondition || '0') + ')'}) ? (${(values2[index] ?? values2)}) : (${file1.molangCondition && file2.molangCondition ? '(' + file1.molangCondition + ') ? ' + (values1[index] ?? values1) + ' : ' + defaultValue : (values1[index] ?? values1)}))`
                });

                if (!Array.isArray(values1) && !Array.isArray(values2)) newValues = newValues[0];

                if (file1.data.bones[bone][action].post) newAnimation.bones[bone][action].post = newValues;
                else newAnimation.bones[bone][action] = newValues;
            }
        }
    }

    return newAnimation;
}

/** @param {String} name @param {String} data */
function downloadFile(name, data, type = 'application/json') {
    const blob = new Blob([data], { type: type });
    const url = URL.createObjectURL(blob);

    const downloader = document.createElement('a');
    downloader.href = url;
    downloader.download = name;

    document.body.appendChild(downloader);
    downloader.click();

    document.body.removeChild(downloader);
    URL.revokeObjectURL(url);
}

{
    /** @type {HTMLInputElement} */
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');

    uploadButton.addEventListener('click', (() => fileInput.click()));
    fileInput.addEventListener('change', (() => {
        for (let rawFile of fileInput.files) {
            const reader = new FileReader();
            reader.onload = (data => {
                FilesStack.addFiles(data.target.result);
                FilesStack.updateUI();
            });

            reader.readAsText(rawFile);
        }
    }));
}

{
    document.getElementById('downloadButton').addEventListener('click', (data => {
        const animation = {
            "format_version": "1.10.0",
            "animations": {
                "animation.combined_animations": {}
            }
        };

        let initialMolangCondition;
        for (let file of FilesStack.getFiles()) {
            if (Object.keys(animation.animations["animation.combined_animations"]).length == 0) {
                animation.animations["animation.combined_animations"] = file.data;
                initialMolangCondition = file.molangCondition;
            } else {
                animation.animations["animation.combined_animations"] = combineAnimations({
                    molangCondition: initialMolangCondition,
                    data: animation.animations["animation.combined_animations"]
                }, file);
                initialMolangCondition = null;
            }
        }

        downloadFile('combined_animations.json', JSON.stringify(animation, null, '    '));
    }))
}