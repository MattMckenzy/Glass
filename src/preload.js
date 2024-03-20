const { ipcRenderer } = require('electron')

window.onload = () => {
    (async () => {

        const glassBarID = await ipcRenderer.invoke('get-id');
        const glassHTMLText = await ipcRenderer.invoke('get-html');
        const glassCSSText = await ipcRenderer.invoke('get-css');

        document.getElementsByTagName('body')[0].insertAdjacentHTML("afterbegin", `<style>${glassCSSText}</style>${glassHTMLText}`);

        const glassBarElement = document.getElementById(glassBarID);
        let isGlassBarOut = false;
        glassBarElement.addEventListener('click', () => {
            glassBarElement.classList.add('out');
            isGlassBarOut = true;
        });

        glassBarElement.querySelector('#closer').addEventListener('click', (event) => {
            glassBarElement.classList.remove('out');
            isGlassBarOut = false;
            event.stopPropagation();
        });

        document.body.addEventListener('click', (event) => {

            if (!isGlassBarOut) {
                return;
            }

            let isInGlassBar = false;
            let currentElement = event.target;
            while (currentElement) {
                if (currentElement.id === glassBarID) {
                    isInGlassBar = true;
                    break;
                }
                currentElement = currentElement.parent;
            }

            if (!isInGlassBar) {
                glassBarElement.classList.remove('out');
                isGlassBarOut = false;
            }

        }, true); 
    })();
};