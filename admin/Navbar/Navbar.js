// TIENE COMO FUNCIONALIDAD HACER FUNCIONAR AL NAVBAR

const menu = document.getElementById('menu');
const sidebar = document.getElementById('sidebar');
const mainContent = document.querySelector('.main-content');

menu.addEventListener('click', () =>{
    sidebar.classList.toggle('menu-toggle');
    menu.classList.toggle('menu-toggle');
    mainContent.classList.toggle('menu-toggle')
});