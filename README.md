# Validador de Impressos — Reforma Tributária

Ferramenta web para conferir os documentos impressos (apólices, endossos, certificados etc.) frente às mudanças da Reforma Tributária. Tudo roda no navegador: os arquivos **não saem do computador**.

**Acesse:** https://pchiesi.github.io/Validador-de-impressos/

## O que é conferido

| Regra | Como é validada | Evidência |
|---|---|---|
| **IOF zerado** | Onde aparece o rótulo IOF, o valor ao lado (ou logo abaixo, em tabelas) precisa ser zero. | Print do trecho em toda ocorrência, aprovada ou não |
| **Sem PIS/COFINS** | Nenhuma menção aos termos proibidos (palavra inteira). | Print com a frase inteira onde o termo aparece |
| **Frase da CBS** | A frase configurada precisa constar no documento. | Print da frase encontrada, com percentual de similaridade e diferenças |

Frase padrão (configurável na aba **Regras**):

> Em atendimento à Lei nº 12.741/12 informamos que incide a alíquota de 10,85% de CBS sobre os prêmios de seguros, deduzidos conforme o estabelecido em legislação específica

## Principais recursos

- **Mapear pasta**: varre a pasta escolhida com todas as subpastas, analisa somente os PDFs e mostra o caminho de cada arquivo, com um mapa da pasta para filtrar os resultados.
- **OCR** para PDFs escaneados e imagens (português).
- **Similaridade da frase** calculada palavra a palavra, na ordem: tolera erros de leitura do OCR e quebras de linha, mas exige números idênticos (ex.: alíquota 9,25% em vez de 10,85% aparece como divergência).
- **Relatório executivo** ao vivo: indicadores, gráficos (situação geral, por regra, por pasta e faixas de similaridade), leitura do resultado e pendências prioritárias com ação sugerida.
- **Exportação**: relatório HTML com gráficos e prints (pronto para salvar em PDF), planilha Excel e tabela para colar.
- Modo claro/escuro, menu lateral recolhível e layout responsivo.

### Situação de cada documento

- **Conforme** — todas as regras atendidas.
- **Revisar** — frase com divergência, IOF citado sem valor legível ou páginas que não puderam ser lidas.
- **Não conforme** — IOF com valor, termo proibido presente ou frase ausente.

## Formatos aceitos

PDF (inclusive escaneado), DOCX, XLSX, PPTX, imagens (PNG, JPG, TIFF…), TXT, HTML, RTF e .doc (leitura aproximada). Ao mapear uma pasta, por padrão só os PDFs entram na análise (ajustável em Regras).

## Desenvolvimento

O site publicado é o arquivo `index.html` na raiz (gerado). As fontes ficam em `src/`:

```
src/template.html   estrutura da página
src/styles.css      estilos (Tailwind CSS)
src/js/*.js         módulos: leitura, análise, prints, interface, relatório
```

Para gerar o `index.html` depois de alterar as fontes:

```bash
npm install
npm run build
```

Bibliotecas carregadas por CDN: pdf.js, Tesseract.js (OCR), Mammoth (Word), SheetJS (Excel), JSZip, Chart.js e Font Awesome.
