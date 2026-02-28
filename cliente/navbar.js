// PERMITE LLMAR A LA NAVBAR

fetch('./Navbar/Navbar.html')
.then(res => res.text())
.then(html =>{
    document.getElementById('navbar').innerHTML = html;
})