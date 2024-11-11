const { ipcRenderer } = require('electron');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

window.onload = () => {
    (async () => {

        document.addEventListener('click', async () => await ipcRenderer.invoke('clicked-in'));

        window.addEventListener("beforeunload", async () => { 
            document.getElementsByTagName('html')[0].classList.add('hide');
            await sleep(125);
            await ipcRenderer.invoke('on-leaving');
        });
       
        const contentCSSText = await ipcRenderer.invoke('get-content-css');
        document.getElementsByTagName('head')[0].insertAdjacentHTML("afterbegin", `<style>${contentCSSText}</style>`);

        document.getElementsByTagName('html')[0].classList.add('hide');
        await sleep(125);
        await ipcRenderer.invoke('on-loaded-content');
        await sleep(500);
        document.getElementsByTagName('html')[0].classList.remove('hide');

    })();
};