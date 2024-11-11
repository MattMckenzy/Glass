const { ipcRenderer } = require('electron');

window.onload = () => {
    (async () => {

        // Click events.

        const glassBarElement = document.getElementById('glass-bar');
        glassBarElement.addEventListener('click', async () => {
            await ipcRenderer.invoke('pop-out');
            glassBarElement.classList.add('out');
        });

        glassBarElement.addEventListener('mouseenter', async () => {
            await ipcRenderer.invoke('hover-in');
        });

        glassBarElement.addEventListener('mouseleave', async () => {
            await ipcRenderer.invoke('hover-out');
        });

        function closeGlass() {
            glassBarElement.classList.remove('out');
            setTimeout(async () => await ipcRenderer.invoke('pop-in'), 500);
        }

        ipcRenderer.on('close-glass', (event) => {
            closeGlass()
        });


        const configuration = await ipcRenderer.invoke('get-configuration');

        // Button configuration

        for (const buttonKey in configuration.buttons) {
            const button = configuration.buttons[buttonKey];

            if (button.enabled) {
                const buttonElement = document.getElementById('button' + button.location);
                buttonElement.insertAdjacentHTML('afterbegin', button.icon);
                buttonElement.classList.remove('hide');

                switch (buttonKey) {
                    case 'close':
                        buttonElement.classList.add('close');
                        buttonElement.addEventListener('click', (event) => { event.stopPropagation(); ipcRenderer.invoke('close'); });
                        break;

                    case 'move':
                        buttonElement.classList.add('move');
                        break;

                    case 'hide':
                        buttonElement.addEventListener('click', (event) => { event.stopPropagation(); closeGlass(); });
                        break;

                    case 'maximize':
                        if (configuration.settings.isMaximized) {
                            buttonElement.classList.add('toggled');
                        }
                        buttonElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            configuration.settings.isMaximized = !configuration.settings.isMaximized;
                            if (!buttonElement.classList.contains('toggled') &&
                                configuration.settings.isMaximized) {
                                buttonElement.classList.add('toggled');
                            }
                            else if (buttonElement.classList.contains('toggled') &&
                                !configuration.settings.isMaximized) {
                                buttonElement.classList.remove('toggled');
                            }
                            ipcRenderer.invoke('toggle-maximize');
                        });
                        break;

                    case 'minimize':
                        buttonElement.addEventListener('click', (event) => { event.stopPropagation(); ipcRenderer.invoke('minimize'); });
                        break;

                    case 'alwaysontop':
                        if (configuration.settings.isAlwaysOnTop) {
                            buttonElement.classList.add('toggled');
                        }
                        buttonElement.addEventListener('click', (event) => {
                            event.stopPropagation();
                            configuration.settings.isAlwaysOnTop = !configuration.settings.isAlwaysOnTop;
                            if (!buttonElement.classList.contains('toggled') &&
                                configuration.settings.isAlwaysOnTop) {
                                buttonElement.classList.add('toggled');
                            }
                            else if (buttonElement.classList.contains('toggled') &&
                                !configuration.settings.isAlwaysOnTop) {
                                buttonElement.classList.remove('toggled');
                            }
                            ipcRenderer.invoke('toggle-alwaysontop');
                        });
                        break;
                }
            }
        }

        // Swiper configuration

        const swiperElement = document.getElementsByClassName('swiper')[0];
        const swiperWrapperElement = document.getElementsByClassName('swiper-wrapper')[0];
    
        for (const location of configuration.locations) {
          const linkElement = document.createElement('div');
          linkElement.classList.add('swiper-slide');
          const imageElement = document.createElement('img');
          imageElement.draggable = false;
          imageElement.src = location.icon;
    
          linkElement.addEventListener('click', (event) => {
            event.stopPropagation();
            ipcRenderer.invoke('navigate', location.url).then(() => {
                closeGlass();
            });
          });
    
          linkElement.appendChild(imageElement);
          swiperWrapperElement.appendChild(linkElement);
        }
    
        let baseWidth = swiperWrapperElement.scrollWidth;
    
        if (baseWidth > swiperElement.clientWidth) {
          swiperElement.classList.add('scroll');
          swiperWrapperElement.classList.add('scroll');
          swiper.enable();
        }
       
        new ResizeObserver(() => {
          if (!swiperElement.classList.contains('scroll') &&
            baseWidth > swiperElement.clientWidth) {
            baseWidth = swiperElement.scrollWidth;
            swiperElement.classList.add('scroll');
            swiperWrapperElement.classList.add('scroll');
            swiper.enable();
          } else if (swiperElement.classList.contains('scroll') &&
            baseWidth <= swiperElement.clientWidth) {
            swiperElement.classList.remove('scroll');
            swiperWrapperElement.classList.remove('scroll');
            swiper.disable();
          }
    
        }).observe(swiperElement);

    })();
};