# 🚀 Guia de Deploy para Hostinger (Apache)

## ✅ Verificações Implementadas

O código foi otimizado para compatibilidade total com servidores Apache/Hostinger:

### 1. **Configuração do Vite (vite.config.ts)**
- ✅ `base: "./"` - Caminhos relativos para assets
- ✅ `sourcemap: false` - Reduz tamanho dos arquivos
- ✅ `manualChunks: undefined` - Evita problemas com chunks
- ✅ `outDir: "dist"` - Pasta de build padrão

### 2. **Arquivo .htaccess Otimizado**
- ✅ Redirecionamento SPA (Single Page Application)
- ✅ Cache otimizado para assets estáticos
- ✅ Compressão Gzip habilitada
- ✅ Headers de segurança configurados
- ✅ Evita cache para HTML (atualizações instantâneas)

### 3. **Caminhos Relativos**
- ✅ Favicon: `./lovable-uploads/...`
- ✅ Script principal: `./src/main.tsx`
- ✅ Todos os assets com caminhos relativos

## 📋 Passos para Deploy

### 1. **Build do Projeto**
```bash
npm run build
```

### 2. **Upload dos Arquivos**
Envie todo o conteúdo da pasta `dist/` para a pasta `public_html` da Hostinger:

```
public_html/
├── index.html
├── .htaccess
├── assets/
│   ├── css/
│   ├── js/
│   └── images/
└── lovable-uploads/
    ├── 50a7b433-bce7-4dc2-8818-e0d903409823.png
    └── 652209de-1cde-4696-a6f1-f944987dde24.png
```

### 3. **Verificar Configurações Apache**
O arquivo `.htaccess` já está configurado para:
- ✅ Roteamento SPA (todas as rotas → index.html)
- ✅ Cache otimizado
- ✅ Compressão Gzip
- ✅ Headers de performance

### 4. **Configurar Variáveis de Ambiente**
As URLs do Supabase já estão hard-coded no código:
- ✅ SUPABASE_URL: `https://frkqhvdsrjuxgcfjbtsp.supabase.co`
- ✅ SUPABASE_ANON_KEY: Configurada no código

## 🔧 Configurações Específicas da Hostinger

### Versão PHP
- Recomendado: PHP 8.1 ou superior
- ✅ Não afeta o funcionamento (app é frontend puro)

### Domínio e SSL
- ✅ Compatível com qualquer domínio
- ✅ HTTPS automático da Hostinger funcionará

### Recursos Utilizados
- ✅ Apenas arquivos estáticos (HTML, CSS, JS)
- ✅ Não requer banco de dados local
- ✅ Conexão externa com Supabase via HTTPS

## ⚡ Performance Otimizada

### Cache Headers Configurados
- **Assets estáticos**: Cache de 1 ano
- **HTML**: Sem cache (atualizações instantâneas)
- **Compressão**: Gzip habilitado

### Tamanho do Build
- ✅ Otimizado para carregamento rápido
- ✅ Chunks automáticos do Vite
- ✅ Assets minificados

## 🛠️ Troubleshooting

### Se as rotas não funcionarem:
1. Verificar se o `.htaccess` foi enviado
2. Confirmar que mod_rewrite está ativo na Hostinger
3. Verificar permissões dos arquivos (644 para arquivos, 755 para pastas)

### Se os assets não carregarem:
1. Confirmar que a pasta `assets/` foi enviada completa
2. Verificar caminhos relativos no browser (F12 → Network)
3. Limpar cache do browser

### Se o Supabase não conectar:
1. Verificar URLs no código
2. Confirmar CORS no painel Supabase
3. Testar conexão em modo incógnito

## ✅ Checklist Final

- [ ] Build executado (`npm run build`)
- [ ] Pasta `dist/` completa enviada para `public_html/`
- [ ] Arquivo `.htaccess` presente
- [ ] Imagens em `lovable-uploads/` enviadas
- [ ] Domínio apontando corretamente
- [ ] SSL ativo na Hostinger
- [ ] Teste de todas as rotas funcionando

## 🎯 Resultado Esperado

Após o deploy, o sistema deve funcionar com:
- ✅ Todas as rotas funcionando (`/`, `/auth`, `/dashboard`)
- ✅ Autenticação via Supabase
- ✅ Reservas funcionando normalmente
- ✅ Dashboard atualizada em tempo real
- ✅ Performance otimizada
- ✅ Cache adequado

---

**🚀 Sistema pronto para produção na Hostinger!**