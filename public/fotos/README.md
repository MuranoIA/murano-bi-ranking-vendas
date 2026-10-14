# Fotos dos vendedores (ranking)

Coloque aqui as fotos dos vendedores que aparecem no ranking, ao lado do nome.

## Como adicionar
1. Salve a foto nesta pasta, de preferência **quadrada** (ex.: 400×400), `.jpg` ou `.png`.
   Sugestão de nome: o primeiro nome em minúsculo, ex.: `anne.jpg`, `milene.jpg`.
2. Mapeie em `fonte-painel.html`, no objeto `FOTOS` (perto do topo do script):

   ```js
   var FOTOS = {
     'anne':   'fotos/anne.jpg',
     'milene': 'fotos/milene.jpg',
     // chave = primeiro nome OU nome completo, minúsculo e sem acento
   };
   ```

3. Sem entrada no `FOTOS` = o ranking mostra as **iniciais** do vendedor (fallback), então nada quebra.

A imagem é recortada em círculo (object-fit: cover). Fotos muito retangulares podem cortar; o ideal é quadrada e centralizada no rosto.
