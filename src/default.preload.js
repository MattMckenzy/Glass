const { ipcRenderer } = require('electron')

window.onload = () => {
    (async () => {
       
        document.addEventListener('click', async () => await ipcRenderer.invoke('clicked-in'));

    })();
};