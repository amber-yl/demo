"use client";

import { useMemo, useState } from "react";

const configs = [
  { name: "Llama 3.1 · PD 分离", note: "推理 / 70B / H100", color: "#775cff" },
  { name: "Qwen 2.5 · 融合部署", note: "推理 / 32B / A100", color: "#20c997" },
  { name: "DeepSeek · 训练集群", note: "训练 / MoE / H800", color: "#ffb648" },
];

const nav = [
  { icon: "◫", label: "总览" },
  { icon: "⌁", label: "算力仿真", children: ["负载建模", "系统仿真", "任务编排"] },
  { icon: "▣", label: "终端" },
  { icon: "ϟ", label: "能源" },
  { icon: "◇", label: "基础设施" },
];

const points = [35, 46, 43, 62, 58, 73, 69, 82, 76, 89, 85, 94];

function Sparkline() {
  const path = points.map((v, i) => `${i === 0 ? "M" : "L"} ${i * 38} ${112 - v}`).join(" ");
  const area = `${path} L 418 112 L 0 112 Z`;
  return (
    <div className="chart" aria-label="吞吐量趋势图">
      <div className="chart-grid" />
      <svg viewBox="0 0 418 112" preserveAspectRatio="none" role="img">
        <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#775cff" stopOpacity=".34"/><stop offset="1" stopColor="#775cff" stopOpacity="0"/></linearGradient></defs>
        <path d={area} fill="url(#area)" /><path d={path} fill="none" stroke="#8d78ff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="chart-tip">18.4k <small>tokens/s</small></span>
      <div className="axis"><span>0s</span><span>30s</span><span>60s</span><span>90s</span></div>
    </div>
  );
}

export default function Home() {
  const [selectedConfig, setSelectedConfig] = useState(0);
  const [activeTab, setActiveTab] = useState("推理");
  const [scene, setScene] = useState("PD 分离");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(true);
  const [agentOpen, setAgentOpen] = useState(true);
  const [messages, setMessages] = useState(["已载入上次的仿真结果。我发现 Decode 阶段 GPU 利用率仍有 11% 的提升空间。"]);
  const [input, setInput] = useState("");
  const runLabel = running ? "仿真运行中 · 68%" : done ? "重新运行仿真" : "运行仿真";
  const modelName = useMemo(() => configs[selectedConfig].name.split(" · ")[0], [selectedConfig]);

  function runSimulation() {
    if (running) return;
    setRunning(true); setDone(false);
    window.setTimeout(() => { setRunning(false); setDone(true); }, 1800);
  }

  function sendMessage() {
    if (!input.trim()) return;
    setMessages((m) => [...m, `你：${input.trim()}`, "建议先把 Prefill 实例数从 4 调整为 6。预计 TTFT 可降低约 14%，功耗增加约 3.8%。"]);
    setInput("");
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">N</span><span>NEBULA</span><small>SIM LAB</small></div>
        <nav>
          {nav.map((item) => <div key={item.label}>
            <button className={`nav-item ${item.label === "算力仿真" ? "active" : ""}`}><span>{item.icon}</span>{item.label}{item.children && <b>⌄</b>}</button>
            {item.children && <div className="subnav">{item.children.map((x) => <button className={x === "负载建模" ? "selected" : ""} key={x}>{x}</button>)}</div>}
          </div>)}
        </nav>
        <div className="sidebar-foot"><button className="nav-item"><span>⚙</span>系统设置</button><div className="user"><div className="avatar">YL</div><div><strong>管理员</strong><small>admin@nebula.ai</small></div><i>···</i></div></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div><span className="crumb">算力仿真 / 负载建模</span><h1>LLM 推理仿真</h1></div>
          <div className="top-actions"><button className="icon-btn" aria-label="消息">♢<em>3</em></button><button className="ghost">保存为配置</button><button className="primary" onClick={runSimulation} disabled={running}><span>{running ? "◌" : "▶"}</span>{runLabel}</button></div>
        </header>

        <div className="workspace">
          <section className="config-panel">
            <div className="panel-heading"><div><h2>仿真配置</h2><p>选择模板并调整本次运行参数</p></div><button className="dots">•••</button></div>
            <label className="label">配置模板</label>
            <div className="config-select">
              <button className="selected-config"><i style={{background: configs[selectedConfig].color}}/><span><strong>{configs[selectedConfig].name}</strong><small>{configs[selectedConfig].note}</small></span><b>⌄</b></button>
              <div className="config-pills">{configs.map((c, i) => <button key={c.name} onClick={() => setSelectedConfig(i)} className={i === selectedConfig ? "on" : ""} aria-label={c.name}><i style={{background:c.color}}/></button>)}</div>
            </div>
            <div className="tabs">{["推理", "训练", "通算", "图算"].map(t => <button onClick={() => setActiveTab(t)} className={activeTab === t ? "on" : ""} key={t}>{t}</button>)}</div>
            <div className="section-title"><span>01</span><div><strong>模型配置</strong><small>Model</small></div><i/></div>
            <div className="field full"><label>模型</label><button className="input"><span>{modelName}</span><b>⌄</b></button></div>
            <div className="field-row"><div className="field"><label>参数量</label><div className="input"><span>{activeTab === "训练" ? "405" : "70"}</span><small>B</small></div></div><div className="field"><label>精度</label><button className="input"><span>FP16</span><b>⌄</b></button></div></div>
            <div className="section-title"><span>02</span><div><strong>系统配置</strong><small>System</small></div><i/></div>
            <div className="field full"><label>加速卡</label><button className="input"><span>NVIDIA H100 SXM</span><b>⌄</b></button></div>
            <div className="field-row"><div className="field"><label>GPU 数量</label><div className="input stepper"><button>−</button><span>32</span><button>＋</button></div></div><div className="field"><label>并行策略</label><button className="input"><span>TP 8 × DP 4</span><b>⌄</b></button></div></div>
            <div className="section-title"><span>03</span><div><strong>运行时配置</strong><small>Runtime</small></div><i/></div>
            <div className="segmented">{["PD 分离", "融合部署"].map(x => <button key={x} onClick={() => setScene(x)} className={scene === x ? "on" : ""}>{x === "PD 分离" ? "分离" : "融合"}<small>{x}</small></button>)}</div>
            <div className="field-row"><div className="field"><label>并发请求</label><div className="input"><span>256</span><small>req</small></div></div><div className="field"><label>序列长度</label><div className="input"><span>2,048</span><small>tokens</small></div></div></div>
          </section>

          <section className="result-panel">
            <div className="result-head"><div><span className={`status ${running ? "running" : ""}`}>{running ? "● RUNNING" : "● COMPLETED"}</span><h2>运行结果 <small>#SIM-20260822-0842</small></h2></div><div><button className="icon-btn">↗</button><button className="icon-btn">⋮</button></div></div>
            {running && <div className="progress"><i/><span>正在模拟 Decode 阶段…</span></div>}
            <div className="metrics">
              <div className="metric hero"><small>系统吞吐量</small><strong>18,420</strong><span>tokens / s</span><em>↑ 12.4%</em></div>
              <div className="metric"><small>首 Token 延迟</small><strong>86.2 <span>ms</span></strong><em>↓ 8.7%</em></div>
              <div className="metric"><small>Token 间延迟</small><strong>19.6 <span>ms</span></strong><em>↓ 3.1%</em></div>
              <div className="metric"><small>GPU 利用率</small><strong>89.4 <span>%</span></strong><em>↑ 5.2%</em></div>
            </div>
            <div className="chart-card"><div className="card-title"><div><strong>吞吐量趋势</strong><small>最近 90 秒 · 平均 17.8k tokens/s</small></div><div className="legend"><i/>实际值 <span/>预测值</div></div><Sparkline /></div>
            <div className="bottom-grid">
              <div className="stage-card"><div className="card-title"><div><strong>阶段耗时</strong><small>端到端延迟分布</small></div></div>
                <div className="stage"><span>排队</span><i><b style={{width:"18%"}}/></i><strong>14 ms</strong></div><div className="stage"><span>Prefill</span><i><b style={{width:"55%"}}/></i><strong>43 ms</strong></div><div className="stage"><span>Decode</span><i><b style={{width:"100%"}}/></i><strong>78 ms</strong></div><div className="total"><span>P95 总延迟</span><strong>135 ms</strong></div>
              </div>
              <div className="insight-card"><div className="spark">✦</div><small>AI 分析</small><h3>还有 <b>11%</b> 的性能空间</h3><p>Decode 节点负载不均。将实例数调整为 6，可在功耗小幅增加的情况下进一步降低延迟。</p><button onClick={() => setAgentOpen(true)}>查看优化建议 <span>→</span></button></div>
            </div>
            <div className="runs"><div className="card-title"><div><strong>最近运行</strong><small>同配置的历史结果</small></div><button>查看全部 →</button></div>
              <table><thead><tr><th>运行 ID</th><th>场景</th><th>吞吐量</th><th>TTFT</th><th>GPU 利用率</th><th>状态</th></tr></thead><tbody>{[["#0842",scene,"18.4k","86ms","89%"],["#0838","PD 分离","16.8k","94ms","84%"],["#0821","融合部署","15.2k","108ms","81%"]].map((r,i)=><tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td><span className={i===0?"good":"muted-status"}>● {i===0?"最新":"完成"}</span></td></tr>)}</tbody></table>
            </div>
          </section>
        </div>
      </section>

      {agentOpen && <aside className="agent-panel">
        <div className="agent-head"><div className="agent-orb">✦</div><div><strong>Simulation Agent</strong><span><i/>在线 · 已连接当前配置</span></div><button onClick={() => setAgentOpen(false)}>×</button></div>
        <div className="agent-context"><small>正在分析</small><strong>{modelName} · {scene}</strong><span>32× H100 · 256 并发</span></div>
        <div className="chat"><div className="date">今天 08:43</div>{messages.map((m,i)=><div key={i} className={m.startsWith("你：") ? "bubble user-bubble" : "bubble"}>{!m.startsWith("你：") && <span className="tiny-orb">✦</span>}<p>{m.replace("你：","")}</p></div>)}
          {messages.length === 1 && <div className="suggestions"><button onClick={()=>setInput("如何降低首 Token 延迟？")}>如何降低首 Token 延迟？</button><button onClick={()=>setInput("对比 PD 分离和融合部署")}>对比 PD 分离和融合部署</button><button onClick={()=>setInput("生成一份优化后的配置")}>生成优化配置</button></div>}
        </div>
        <div className="composer"><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage()}}} placeholder="询问当前配置、结果或优化建议…"/><div><button>＋</button><span>Agent 可读取当前仿真上下文</span><button className="send" onClick={sendMessage}>↑</button></div></div>
      </aside>}
      {!agentOpen && <button className="agent-fab" onClick={()=>setAgentOpen(true)}>✦<span>AI Agent</span></button>}
    </main>
  );
}
