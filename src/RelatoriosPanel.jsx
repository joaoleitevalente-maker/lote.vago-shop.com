import React, { useState, useEffect } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Download } from "lucide-react";
import { C, brl, sbFetch, formatCaptureMethod } from "./App.jsx";

const CHART_COLORS = [C.ink, C.cold, C.red, C.amber, C.kraftDark, C.inkSoft];

function exportarCSV(pedidos) {
  const headers = ["ID", "Data", "Cliente", "E-mail", "Telefone", "Entrega", "Bairro", "Endereço", "Itens", "Subtotal", "Frete", "Total", "Pago", "Forma de pagamento", "Enviado"];
  const linhas = pedidos.map((p) => [
    p.id, new Date(p.created_at).toLocaleString("pt-BR"), p.nome, p.email, p.telefone,
    p.entrega === "entrega" ? "Entrega" : "Retirada", p.bairro || "", p.endereco || "",
    (p.itens || []).map((i) => `${i.qty}x ${i.name}`).join("; "),
    p.subtotal, p.frete, p.total, p.pago ? "Sim" : "Não", formatCaptureMethod(p.pagamento), p.enviado ? "Sim" : "Não",
  ]);
  const csv = [headers, ...linhas]
    .map((linha) => linha.map((cel) => `"${String(cel ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pedidos_vago_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RelatoriosPanel({ accessToken }) {
  const [pedidos, setPedidos] = useState(null);
  const [dataDe, setDataDe] = useState("");
  const [dataAte, setDataAte] = useState("");
  const [filtroPago, setFiltroPago] = useState("todos");
  const [filtroEntrega, setFiltroEntrega] = useState("todos");

  useEffect(() => {
    (async () => {
      try {
        const rows = await sbFetch("orders?select=*&order=created_at.desc&limit=1000", { accessToken });
        setPedidos(rows || []);
      } catch (e) {
        console.error("Falha ao carregar pedidos pros relatórios", e);
        setPedidos([]);
      }
    })();
  }, [accessToken]);

  if (pedidos === null) return <p style={{ fontSize: 13, color: C.inkFaint }}>carregando relatórios…</p>;

  const filtrados = pedidos.filter((p) => {
    const dia = p.created_at.slice(0, 10);
    if (dataDe && dia < dataDe) return false;
    if (dataAte && dia > dataAte) return false;
    if (filtroPago === "pago" && !p.pago) return false;
    if (filtroPago === "nao_pago" && p.pago) return false;
    if (filtroEntrega !== "todos" && p.entrega !== filtroEntrega) return false;
    return true;
  });

  const totalPedidos = filtrados.length;
  const pagos = filtrados.filter((p) => p.pago);
  const naoPagos = totalPedidos - pagos.length;
  const totalVendido = pagos.reduce((s, p) => s + Number(p.total), 0);
  const ticketMedio = pagos.length > 0 ? totalVendido / pagos.length : 0;

  const diasSemanaLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const porDiaSemana = diasSemanaLabels.map((label, i) => ({
    dia: label,
    pedidos: filtrados.filter((p) => new Date(p.created_at).getDay() === i).length,
  }));

  const clientesMap = {};
  filtrados.forEach((p) => {
    const key = p.email || p.telefone || p.nome;
    if (!clientesMap[key]) clientesMap[key] = { nome: p.nome, pedidos: 0, total: 0 };
    clientesMap[key].pedidos += 1;
    clientesMap[key].total += Number(p.total);
  });
  const rankingClientes = Object.values(clientesMap).sort((a, b) => b.total - a.total).slice(0, 8);

  const produtosMap = {};
  filtrados.forEach((p) => (p.itens || []).forEach((i) => {
    const key = i.id || i.name;
    if (!produtosMap[key]) produtosMap[key] = { nome: i.name, qty: 0 };
    produtosMap[key].qty += Number(i.qty) || 0;
  }));
  const topProdutos = Object.values(produtosMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

  const categoriaMap = {};
  filtrados.forEach((p) => (p.itens || []).forEach((i) => {
    const cat = i.category || "sem categoria salva";
    categoriaMap[cat] = (categoriaMap[cat] || 0) + (Number(i.qty) || 0) * (Number(i.price) || 0);
  }));
  const categoriaData = Object.entries(categoriaMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const bairroMap = {};
  filtrados.filter((p) => p.entrega === "entrega").forEach((p) => {
    const b = p.bairro && p.bairro.trim() ? p.bairro.trim() : "não informado";
    bairroMap[b] = (bairroMap[b] || 0) + 1;
  });
  const bairroData = Object.entries(bairroMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, pedidos]) => ({ name, pedidos }));

  const inputStyleF = { background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: "7px 9px", color: C.ink, fontSize: 12 };
  const labelF = { fontSize: 10, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.03em" };
  const chipStyle = (ativo, cor) => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em",
    background: ativo ? cor : C.paper, color: ativo ? C.white : C.inkSoft, border: `1px solid ${ativo ? cor : C.line}`,
  });
  const cardTitle = { fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em", color: C.inkSoft, marginBottom: 12 };
  const tickStyle = { fontSize: 11, fill: C.inkSoft, fontFamily: "'Courier Prime', monospace" };

  return (
    <div>
      <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 14, marginBottom: 16 }}>
        <div className="flex gap-3" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={labelF}>De
            <input type="date" style={{ ...inputStyleF, display: "block", marginTop: 3 }} value={dataDe} onChange={(e) => setDataDe(e.target.value)} />
          </label>
          <label style={labelF}>até
            <input type="date" style={{ ...inputStyleF, display: "block", marginTop: 3 }} value={dataAte} onChange={(e) => setDataAte(e.target.value)} />
          </label>
          <div className="flex gap-2">
            {[{ v: "todos", l: "Todos" }, { v: "pago", l: "Pago" }, { v: "nao_pago", l: "Não pago" }].map((op) => (
              <button key={op.v} onClick={() => setFiltroPago(op.v)} style={chipStyle(filtroPago === op.v, C.cold)}>{op.l}</button>
            ))}
          </div>
          <div className="flex gap-2">
            {[{ v: "todos", l: "Todos" }, { v: "entrega", l: "Entrega" }, { v: "retirada", l: "Retirada" }].map((op) => (
              <button key={op.v} onClick={() => setFiltroEntrega(op.v)} style={chipStyle(filtroEntrega === op.v, C.ink)}>{op.l}</button>
            ))}
          </div>
          <button
            onClick={() => exportarCSV(filtrados)}
            style={{
              marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: C.ink, color: C.paper,
              border: "none", borderRadius: 4, padding: "8px 14px", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase",
            }}
          >
            <Download size={13} /> Exportar CSV ({totalPedidos})
          </button>
        </div>
      </div>

      {totalPedidos === 0 ? (
        <div style={{ border: `1px dashed ${C.kraftLine}`, borderRadius: 4, padding: 32, textAlign: "center", color: C.inkFaint, fontSize: 13 }}>
          nenhum pedido encontrado com esses filtros.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 16 }}>
            {[
              { label: "Total vendido", valor: brl(totalVendido) },
              { label: "Pedidos", valor: totalPedidos },
              { label: "Ticket médio", valor: brl(ticketMedio) },
              { label: "Pago / não pago", valor: `${pagos.length} / ${naoPagos}` },
            ].map((c) => (
              <div key={c.label} style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 14 }}>
                <p style={{ fontSize: 10, color: C.inkFaint, textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 6 }}>{c.label}</p>
                <p style={{ fontSize: 18, fontWeight: 700, color: C.ink }}>{c.valor}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16 }}>
              <p style={cardTitle}>Pedidos por dia da semana</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={porDiaSemana}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                  <XAxis dataKey="dia" tick={tickStyle} axisLine={{ stroke: C.line }} tickLine={false} />
                  <YAxis tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 12, fontFamily: "'Courier Prime', monospace", borderRadius: 4, borderColor: C.line }} />
                  <Bar dataKey="pedidos" fill={C.cold} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16 }}>
              <p style={cardTitle}>Ranking de clientes</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rankingClientes.map((c, i) => (
                  <div key={c.nome + i} className="flex items-center justify-between" style={{ fontSize: 12.5 }}>
                    <span style={{ color: C.inkSoft }}>{i + 1}. {c.nome} <span style={{ color: C.inkFaint }}>({c.pedidos}x)</span></span>
                    <span style={{ fontWeight: 700, color: C.ink }}>{brl(c.total)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16 }}>
              <p style={cardTitle}>Produtos mais vendidos (unidades)</p>
              <ResponsiveContainer width="100%" height={Math.max(160, topProdutos.length * 32)}>
                <BarChart data={topProdutos} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="nome" tick={{ ...tickStyle, fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, fontFamily: "'Courier Prime', monospace", borderRadius: 4, borderColor: C.line }} />
                  <Bar dataKey="qty" fill={C.ink} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16 }}>
              <p style={cardTitle}>Faturamento por categoria</p>
              {categoriaData.length === 0 ? (
                <p style={{ fontSize: 12, color: C.inkFaint }}>sem dados suficientes ainda.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={categoriaData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={{ fontSize: 10, fontFamily: "'Courier Prime', monospace" }}>
                      {categoriaData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => brl(v)} contentStyle={{ fontSize: 12, fontFamily: "'Courier Prime', monospace", borderRadius: 4, borderColor: C.line }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ background: C.white, border: `1px solid ${C.line}`, borderRadius: 4, padding: 16, gridColumn: "1 / -1" }}>
              <p style={cardTitle}>Pedidos por bairro/região</p>
              {bairroData.length === 0 ? (
                <p style={{ fontSize: 12, color: C.inkFaint }}>sem entregas no período filtrado.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, bairroData.length * 32)}>
                  <BarChart data={bairroData} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis type="category" dataKey="name" tick={{ ...tickStyle, fontSize: 10 }} width={130} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, fontFamily: "'Courier Prime', monospace", borderRadius: 4, borderColor: C.line }} />
                    <Bar dataKey="pedidos" fill={C.amber} radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p style={{ fontSize: 10, color: C.inkFaint, marginTop: 8 }}>bairro só é salvo em pedidos feitos após a atualização recente — pedidos antigos aparecem como "não informado".</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

