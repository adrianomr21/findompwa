Tenho uma planilha sheet com dados financeiros domésticos que cadastro diariamente. Quero criar um pwa sistema html e js hospedado no github para mostrar um dashboard de alguns dados por período.

O foco principal é 

- Login rápido (firebase).
- Pwa para instalar no mobile.
- Linguagem: Html, js e css.
- Criar testes unitários para garantir o funcionamento correto do sistema.
- Ao entrar já cai na tela de cadastro, depois de finalizar o cadastro, é direcionado para o dashboard com o total de gasto até o momento. No topo fica o filtro por mês, ano, categoria e tipo de categoria. Abaixo mostra graficos das categorias do quanto já foram preenchidas. Abaixo mostra o histórico das despesas com opção de edição. Ao editar aparece um modal com todos os dados para ajustes e botões para salvar, cancelar e excluir.
- Na tela de cadastro, primeiramente coloco o valor total da despesa, opções á vista ou parcelado (abre campo de quantas parcelas). Dropdown com os tipo de pagamentos. Nome da despesa. Dropdown com as categorias. gráfico de barra mostrando o total da categoria selecionada e quanto já foi preenchida. Campo para anotações. Botão cadastrar e cancelar. Total de despesas fica no topo flutuante e fixo.
- Layout clean e transmite sentimento de controle e equilibrio.
- Tela de configurações: gerenciar formas de pagamento (cartão 1 crédito, cartão 2 débito, pix, dinheiro…). Criar, atualizar e excluir. Cartão de crédito precisa de nome, data de inicio e fim da fatura e data de pagamento. Boleto precisa de data de vencimento. Os demais (débito, pix, dinheiro…) somente o nome. Gerenciar categorias e seus valores limites. Gerenciar as dívidas fixas (água, luz, internet, assinaturas…) nome, valor, data de pagamento e anotações.
- Tela de Efetuar Pagamentos: Listar os cartões de crédito para serem pagos, boletos, dívidas fixas… com seus valores e um checkbox “Pago” que registra automáticamente a data de pagamento. Opção de alterar o valor pago, caso houver algum cadastro errado ou faltando. Salvar os dados para cada mês. No topo ter filtro para o mês de pagamento e sempre atualiza no mes atual.
- importar dados em lote