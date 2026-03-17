import { useState, useEffect, useRef } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import ABI from './abi.json'
import { CONTRACT_ADDRESS, EXPECTED_CHAIN_ID, EXPECTED_NETWORK_NAME } from './config'
import './index.css'
import './styles.css'
import imgLeonBlum   from '../img/leon_blum.png'
import imgChirac     from '../img/chiraq.png'
import imgMitterrand from '../img/miterrand.png'

// ─── Static data ──────────────────────────────────────────────────────────────
const CANDIDATE_NAMES = ['Léon Blum', 'Jacques Chirac', 'François Mitterrand']
const CANDIDATE_IMGS  = [imgLeonBlum, imgChirac, imgMitterrand]

const ACCORDION_ITEMS = [
  {
    title: '① Connexion MetaMask',
    content: "MetaMask est votre identité sur la blockchain. Quand vous cliquez 'Connecter', MetaMask expose votre adresse publique (0x...) à l'application. Cette adresse est votre identifiant unique — il n'y a pas de login, pas de mot de passe, pas de serveur. La clé privée ne quitte jamais MetaMask.",
  },
  {
    title: '② Signer une transaction',
    content: "Voter = envoyer une transaction à un smart contract. MetaMask calcule le hash de cette transaction, le signe avec votre clé privée (algorithme ECDSA), et diffuse la transaction signée sur le réseau Ethereum. Le réseau vérifie la signature — sans jamais voir votre clé privée — et confirme que c'est bien vous qui avez voté.",
  },
  {
    title: '③ Confirmation on-chain',
    content: "Une fois signée, la transaction entre dans le mempool — la file d'attente des transactions en attente. Un validateur la sélectionne et l'inclut dans un bloc. Sur Ethereum Sepolia, ça prend ~12 secondes. Après ~12,8 minutes (2 époques), le bloc est finalisé : le vote est irréversible, public, et vérifiable par tous sur Etherscan.",
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner() {
  return <span className="spinner" />
}

function TxStatusBanner({ status }) {
  if (!status) return null
  const steps = {
    1: { icon: '⏳', label: 'Signature dans MetaMask...' },
    2: { icon: '📡', label: 'Transaction envoyée — hash :' },
    3: { icon: '⏱',  label: 'En attente de confirmation (~12 secondes)...' },
    4: { icon: '✅', label: 'Incluse dans le bloc' },
  }
  const m = steps[status.step]
  return (
    <div className="tx-banner">
      <span>{m.icon}</span>
      <span>{m.label}</span>
      {(status.step === 2 || status.step === 3) && status.hash && (
        <span className="tx-hash-full">{status.hash}</span>
      )}
      {status.step === 4 && status.blockNumber && (
        <span style={{ color: 'var(--gold)' }}>#{status.blockNumber}</span>
      )}
    </div>
  )
}

function DataRow({ label, value, link, highlight, last }) {
  return (
    <div className={`modal-row${last ? ' modal-row--last' : ''}`}>
      <div className="modal-label">{label}</div>
      {link ? (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="modal-value modal-value-link">{value}</a>
      ) : (
        <div className="modal-value" style={highlight ? { color: highlight } : undefined}>{value}</div>
      )}
    </div>
  )
}

function BlockModal({ data, loading, onClose, onNavigate, voteBlocks }) {
  const [showExtra, setShowExtra] = useState(false)
  const [slideDir, setSlideDir] = useState(null)
  if (!data) return null
  const { event, block } = data
  const fmt    = (ts) => ts != null ? new Date(ts * 1000).toLocaleString('fr-FR') : '—'
  const fmtNum = (n)  => n  != null ? Number(n).toLocaleString('fr-FR') : '—'
  const sortedBlocks = [...voteBlocks].sort((a, b) => b - a)
  const currentIdx = block?.number != null ? sortedBlocks.indexOf(block.number) : -1
  const canPrev = currentIdx > 0
  const canNext = currentIdx !== -1 && currentIdx < sortedBlocks.length - 1

  const handleNavigate = (targetBlock, dir) => {
    setSlideDir(dir)
    onNavigate(targetBlock)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">BLOC #{block?.number ?? '...'} — Vue détaillée</div>
          <div className="modal-header-actions">
            {block?.number != null && (
              <a href={`https://sepolia.etherscan.io/block/${block.number}`}
                target="_blank" rel="noopener noreferrer"
                className="modal-close-btn modal-etherscan-btn">
                🔍 Etherscan
              </a>
            )}
            <button className="modal-close-btn" onClick={onClose}>✕ Fermer</button>
          </div>
        </div>

        {(
          <div className="modal-body" style={loading ? { opacity: 0.45, pointerEvents: 'none', transition: 'opacity 0.15s' } : { transition: 'opacity 0.15s' }}>
          <div key={block?.number} className={slideDir ? `block-content--slide-${slideDir}` : ''}>
            {event ? (
              <>
                <DataRow label="Transaction Hash"
                  value={event.hash ?? '—'}
                  link={event.hash ? `https://sepolia.etherscan.io/tx/${event.hash}` : null} />
                <DataRow label="Votant"          value={event.voter ?? '—'} />
                <DataRow label="Candidat voté"   value={event.candidateName ?? '—'} highlight="var(--gold)" />
                <DataRow label="Gas (tx)"        value={event.gasUsed != null ? `${fmtNum(event.gasUsed)} unités` : '—'} />
              </>
            ) : (
              <p className="modal-no-event">Aucun vote enregistré dans ce bloc.</p>
            )}
            <DataRow label="Numéro de bloc" value={block?.number != null ? `#${block.number}` : '—'} />
            <DataRow label="Timestamp"      value={fmt(block?.timestamp)} />
            <DataRow label="parentHash"     value={block?.parentHash ?? '—'} />

            <button
              className="explorer-toggle-btn modal-extra-toggle"
              style={{ marginBottom: showExtra ? '16px' : '0' }}
              onClick={() => setShowExtra(s => !s)}>
              {showExtra ? '▴ Masquer les détails' : "▾ Plus d'infos sur ce bloc"}
            </button>

            {showExtra && (
              <>
                <DataRow label="gasLimit (bloc)"    value={block?.gasLimit    != null ? `${fmtNum(block.gasLimit)} unités`    : '—'} />
                <DataRow label="gasUsed (bloc)"     value={block?.gasUsedBlock != null ? `${fmtNum(block.gasUsedBlock)} unités` : '—'} />
                <DataRow label="Validateur (miner)" value={block?.miner ?? '—'} last />
              </>
            )}

            <div className="pedagogy" style={{ marginTop: '24px' }}>
              🔐 Le parentHash est le hash du bloc précédent. C'est ce lien cryptographique qui rend la blockchain immuable : modifier ce bloc changerait son hash, invalidant le parentHash du bloc suivant, cassant toute la chaîne jusqu'au bout.
            </div>
          </div>
          </div>
        )}

        {/* Navigation */}
        <div className="modal-nav">
          <button className="modal-nav-btn" onClick={() => canPrev && handleNavigate(sortedBlocks[currentIdx - 1], 'left')} disabled={!canPrev}>
            ← Bloc précédent
          </button>
          <button className="modal-nav-btn" onClick={() => canNext && handleNavigate(sortedBlocks[currentIdx + 1], 'right')} disabled={!canNext}>
            Bloc suivant →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
function App() {
  const [account, setAccount]                 = useState(null)
  const [provider, setProvider]               = useState(null)
  const [candidates, setCandidates]           = useState([])
  const [isVoting, setIsVoting]               = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [error, setError]                     = useState(null)
  const [lastEvent, setLastEvent]             = useState(null)
  const [txStatus, setTxStatus]               = useState(null)
  const [txHash, setTxHash]                   = useState(null)
  const [txGasUsed, setTxGasUsed]             = useState(null)
  const [explorerOpen, setExplorerOpen]       = useState(false)
  const [explorerEvents, setExplorerEvents]   = useState([])
  const [explorerLoading, setExplorerLoading] = useState(false)
  const [openAccordions, setOpenAccordions]   = useState({})
  const [modalData, setModalData]             = useState(null)
  const [modalLoading, setModalLoading]       = useState(false)
  const connectRef = useRef(null)

  // ── Chargement initial sans MetaMask ──────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!window.ethereum) return
      try {
        const p = new BrowserProvider(window.ethereum)
        setProvider(p)
        await loadCandidates(p)
      } catch { /* silent */ }
    }
    init()
  }, [])

  // ── Connexion wallet ──────────────────────────────────────────────────────────
  const connectWallet = async () => {
    try {
      if (!window.ethereum) { setError("MetaMask n'est pas installé."); return }
      const _provider = new BrowserProvider(window.ethereum)
      await _provider.send("eth_requestAccounts", [])
      const network = await _provider.getNetwork()
      if (network.chainId !== BigInt(EXPECTED_CHAIN_ID)) {
        setError(`Mauvais réseau — connectez MetaMask sur ${EXPECTED_NETWORK_NAME}.`)
        return
      }
      const signer = await _provider.getSigner()
      const address = await signer.getAddress()
      setAccount(address)
      setProvider(_provider)
      setError(null)
      await loadCandidates(_provider)
    } catch { setError("Connexion refusée.") }
  }

  // ── Chargement des candidats ──────────────────────────────────────────────────
  const loadCandidates = async (_provider) => {
    const c = new Contract(CONTRACT_ADDRESS, ABI, _provider)
    const count = await c.getCandidatesCount()
    const list = []
    for (let i = 0; i < Number(count); i++) {
      const [name, voteCount] = await c.getCandidate(i)
      list.push({ id: i, name, votes: Number(voteCount) })
    }
    setCandidates(list)
  }

  // ── Chargement des events explorer ───────────────────────────────────────────
  const loadExplorerEvents = async (_provider) => {
    const p = _provider || provider
    if (!p) return
    setExplorerLoading(true)
    try {
      const ec = new Contract(CONTRACT_ADDRESS, ABI, p)
      const raw = await ec.queryFilter(ec.filters.Voted(), 0)
      const all = raw.slice().reverse()
      const enriched = await Promise.all(all.map(async (e) => {
        let timestamp = null, parentHash = null, gasUsed = null
        let gasLimit = null, miner = null, gasUsedBlock = null
        const idx = Number(e.args.candidateIndex)
        const candidateName = CANDIDATE_NAMES[idx] ?? `Candidat #${idx}`
        try {
          const block = await p.getBlock(e.blockNumber)
          timestamp    = block?.timestamp  ?? null
          parentHash   = block?.parentHash ?? null
          gasLimit     = block?.gasLimit   != null ? Number(block.gasLimit) : null
          miner        = block?.miner      ?? null
          gasUsedBlock = block?.gasUsed    != null ? Number(block.gasUsed)  : null
        } catch { /* silent */ }
        try {
          const receipt = await p.getTransactionReceipt(e.transactionHash)
          gasUsed = receipt?.gasUsed != null ? Number(receipt.gasUsed) : null
        } catch { /* silent */ }
        return {
          hash: e.transactionHash,
          blockNumber: e.blockNumber,
          voter: e.args.voter,
          candidateIndex: idx,
          candidateName,
          timestamp, parentHash, gasUsed, gasLimit, miner, gasUsedBlock,
        }
      }))
      setExplorerEvents(enriched)
    } catch {
      setExplorerEvents([])
    } finally {
      setExplorerLoading(false)
    }
  }

  // ── Vote ──────────────────────────────────────────────────────────────────────
  const vote = async (candidateId) => {
    try {
      setIsVoting(true)
      setError(null)
      setTxStatus({ step: 1 })
      const signer = await provider.getSigner()
      const voteContract = new Contract(CONTRACT_ADDRESS, ABI, signer)
      const secondsLeft = Number(await voteContract.getTimeUntilNextVote(account))
      if (secondsLeft > 0) {
        setCooldownSeconds(secondsLeft)
        setIsVoting(false)
        setTxStatus(null)
        return
      }
      const tx = await voteContract.vote(candidateId)
      setTxHash(tx.hash)
      setTxStatus({ step: 2, hash: tx.hash })
      setTxStatus({ step: 3, hash: tx.hash })
      const receipt = await tx.wait()
      setTxGasUsed(Number(receipt.gasUsed))
      setTxStatus({ step: 4, hash: tx.hash, blockNumber: receipt.blockNumber })
      await loadCandidates(provider)
      if (explorerOpen) loadExplorerEvents()
      setCooldownSeconds(3 * 60)
    } catch (err) {
      setTxStatus(null)
      setError(err.code === 4001 ? "Transaction annulée." : "Erreur : " + err.message)
    } finally {
      setIsVoting(false)
    }
  }

  // ── Écoute des events on-chain ────────────────────────────────────────────────
  useEffect(() => {
    if (!provider) return
    let listenContract
    try {
      listenContract = new Contract(CONTRACT_ADDRESS, ABI, provider)
      const handler = (voter, candidateIndex) => {
        const idx = Number(candidateIndex)
        setLastEvent({
          voter: voter.slice(0, 6) + '...' + voter.slice(-4),
          candidateName: CANDIDATE_NAMES[idx] ?? `Candidat #${idx}`,
        })
        loadCandidates(provider)
      }
      listenContract.on("Voted", handler)
      return () => { listenContract.off("Voted", handler) }
    } catch (err) {
      console.warn("Impossible d'écouter les events :", err.message)
    }
  }, [provider])

  useEffect(() => {
    if (explorerOpen && provider) loadExplorerEvents()
  }, [explorerOpen])

  // ── Countdown cooldown ────────────────────────────────────────────────────────
  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) { clearInterval(timer); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [cooldownSeconds])

  // ── Modal helpers ─────────────────────────────────────────────────────────────
  const openModal = (event) => {
    setModalData({
      event,
      block: {
        number:       event.blockNumber,
        parentHash:   event.parentHash,
        timestamp:    event.timestamp,
        gasLimit:     event.gasLimit,
        miner:        event.miner,
        gasUsedBlock: event.gasUsedBlock,
      },
    })
  }

  const navigateModal = async (targetNum) => {
    setModalLoading(true)
    try {
      const block = await provider.getBlock(targetNum)
      const matchingEvent = explorerEvents.find(e => e.blockNumber === targetNum) || null
      setModalData({
        event: matchingEvent,
        block: {
          number:       block.number,
          parentHash:   block.parentHash,
          timestamp:    block.timestamp,
          gasLimit:     block.gasLimit    != null ? Number(block.gasLimit)  : null,
          miner:        block.miner       ?? null,
          gasUsedBlock: block.gasUsed     != null ? Number(block.gasUsed)   : null,
        },
      })
    } catch { /* silent */ }
    finally { setModalLoading(false) }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const totalVotes       = candidates.reduce((s, c) => s + c.votes, 0)
  const toggleAccordion  = (i) => setOpenAccordions(prev => ({ ...prev, [i]: !prev[i] }))
  const fmt              = (ts) => ts != null ? new Date(ts * 1000).toLocaleString('fr-FR') : '—'
  const voteBlocks = explorerEvents.map(e => e.blockNumber)

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="page">

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="logo">dApp<span className="logo-dot">.</span>Vote</div>
        <span className="badge">⬡ Sepolia Testnet</span>
      </nav>

      {/* ── Hero ── */}
      <div className="hero">
        <div className="tag">⛓ Live on Ethereum</div>
        <h1 className="h1">Vote décentralisé<br />sans intermédiaire</h1>
        <p className="subtitle">
          Chaque vote est une transaction signée sur la blockchain Ethereum.<br />
          Transparent, immuable, vérifiable par tous.
        </p>
      </div>

      {/* ── Wallet ── */}
      <div className="card" ref={connectRef}>
        <div className="card-title"><span className="card-title-accent" />Wallet</div>
        {!account ? (
          <button className="connect-btn" onClick={connectWallet}>
            <span>🦊</span> Connecter MetaMask
          </button>
        ) : (
          <div className="address-pill">
            <div className="dot" />
            <span className="address-text">{account}</span>
            <span className="network-label">· {EXPECTED_NETWORK_NAME}</span>
          </div>
        )}
        {error && <div className="banner-error">⚠ {error}</div>}
      </div>

      {/* ── Smart Contract ── */}
      <div className="card">
        <div className="card-title">
          <span className="card-title-accent" />
          📄 Smart Contract déployé sur Ethereum Sepolia
        </div>
        <div className="contract-address">{CONTRACT_ADDRESS}</div>
        <div className="contract-links">
          <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}`}
            target="_blank" rel="noopener noreferrer" className="contract-link">
            🔍 Voir le contrat
          </a>
          <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#transactions`}
            target="_blank" rel="noopener noreferrer" className="contract-link">
            📋 Transactions
          </a>
          <a href={`https://sepolia.etherscan.io/address/${CONTRACT_ADDRESS}#events`}
            target="_blank" rel="noopener noreferrer" className="contract-link">
            ⚡ Events
          </a>
        </div>
        <p className="contract-desc">
          Ce contrat est déployé de façon permanente sur Ethereum Sepolia. Son code ne peut plus être modifié —
          c'est l'immuabilité de la blockchain. Chaque vote appelle la fonction{' '}
          <span className="accent">vote(candidateIndex)</span> qui vérifie que vous n'avez pas déjà voté via{' '}
          <span className="accent">require(!hasVoted[msg.sender])</span>, incrémente le compteur du candidat,
          et émet un event <span className="accent-gold">Voted</span> enregistré de façon permanente dans les logs
          de la transaction.
        </p>
      </div>

      {/* ── Accordéon ── */}
      <div className="card">
        <div className="card-title" style={{ marginBottom: '8px' }}>
          <span className="card-title-accent" />
          💡 Comment fonctionne ce vote on-chain ?
        </div>
        {ACCORDION_ITEMS.map((item, i) => (
          <div key={i} className="accordion-item">
            <button className="accordion-btn" onClick={() => toggleAccordion(i)}>
              <span>{item.title}</span>
              <span className="accordion-chevron"
                style={{ transform: openAccordions[i] ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                ▾
              </span>
            </button>
            <div className="accordion-body" style={{ maxHeight: openAccordions[i] ? '300px' : '0px' }}>
              <p className="accordion-content">{item.content}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Candidats ── */}
      {candidates.length > 0 && (
        <div className="card">
          <div className="card-title">
            <span className="card-title-accent" />
            Candidats
            <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '11px', fontWeight: '400' }}>
              {totalVotes} vote{totalVotes !== 1 ? 's' : ''} enregistré{totalVotes !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="candidates-grid">
            {candidates.map((c) => {
              const pct = totalVotes > 0 ? Math.round((c.votes / totalVotes) * 100) : 0
              return (
                <div key={c.id} className="candidate-card">
                  <div className="candidate-card-top" />
                  <img src={CANDIDATE_IMGS[c.id]} alt={c.name} className="candidate-img" />
                  <div className="candidate-name">{c.name}</div>
                  <div className="candidate-votes">{c.votes}</div>
                  <div className="candidate-votes-label">votes</div>

                  <div className="progress-wrap">
                    <div className="progress-bar"
                      style={{
                        width: `${pct}%`,
                        boxShadow: pct > 0 ? '0 0 8px var(--mint-glow)' : 'none',
                      }} />
                  </div>
                  <div className="progress-pct">{pct}%</div>

                  {!account ? (
                    <button className="connect-to-vote-btn"
                      onClick={() => connectRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                      🦊 Connectez-vous pour voter
                    </button>
                  ) : cooldownSeconds === 0 ? (
                    <button className="vote-btn" onClick={() => vote(c.id)} disabled={isVoting}>
                      {isVoting ? '⏳ En cours...' : 'Voter →'}
                    </button>
                  ) : null}
                </div>
              )
            })}
          </div>

          {txStatus && (isVoting || txStatus.step === 4) && (
            <TxStatusBanner status={txStatus} />
          )}

          {txStatus?.step === 4 && txStatus.blockNumber && (
            <div className="pedagogy" style={{ marginTop: '12px' }}>
              ⛓ Votre transaction a été incluse dans le bloc{' '}
              <span style={{ color: 'var(--gold)' }}>#{txStatus.blockNumber}</span>.
              Elle est maintenant permanente sur Ethereum Sepolia.
              {txGasUsed != null && (
                <> gasUsed = <span style={{ color: 'var(--mint)' }}>{txGasUsed.toLocaleString('fr-FR')} unités</span> — c'est le coût computationnel de l'exécution de vote() sur l'EVM.</>
              )}
            </div>
          )}

          {txStatus?.step === 4 && (
            <div className="banner-success">✓ Vote enregistré sur la blockchain Ethereum</div>
          )}

          {cooldownSeconds > 0 && (
            <div className="cooldown-box">
              <div className="cooldown-label">⏳ Prochain vote disponible dans</div>
              <div className="cooldown-timer">
                {String(Math.floor(cooldownSeconds / 60)).padStart(2, '0')}:{String(cooldownSeconds % 60).padStart(2, '0')}
              </div>
              <div className="cooldown-sub">La blockchain enregistre l'heure de votre dernier vote via block.timestamp</div>
            </div>
          )}

          {txStatus?.step === 4 && txHash && (
            <a href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank" rel="noopener noreferrer"
              className="etherscan-link">
              🔍 Voir la transaction sur Etherscan →
            </a>
          )}

          {lastEvent && (
            <div className="event-banner">
              <span style={{ color: 'var(--mint)' }}>⚡</span>
              <span>
                Nouveau vote —{' '}
                <strong style={{ color: 'var(--mint)' }}>{lastEvent.voter}</strong>
                {' '}→{' '}
                <strong style={{ color: 'var(--gold)' }}>{lastEvent.candidateName}</strong>
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Blockchain Explorer ── */}
      <div className="card">
        <div className="explorer-header">
          <div className="card-title" style={{ marginBottom: 0 }}>
            <span className="card-title-accent" />
            ⛓ Blockchain Explorer
          </div>
          <button className="explorer-toggle-btn" onClick={() => setExplorerOpen(o => !o)}>
            {explorerOpen ? 'Masquer' : 'Afficher'}
          </button>
        </div>

        <div style={{ maxHeight: explorerOpen ? '800px' : '0px', overflow: 'hidden', transition: 'max-height 0.4s ease' }}>
          <div className="pedagogy" style={{ marginTop: '20px', marginBottom: '4px' }}>
            📚 Ce que vous voyez ici est l'historique immuable des transactions enregistrées on-chain.
            Chaque ligne est un bloc Ethereum contenant votre vote. Le parentHash relie chaque bloc au précédent —
            modifier un bloc invaliderait toute la chaîne. C'est le mécanisme d'immuabilité vu en cours.
          </div>

          {explorerLoading ? (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '12px' }}>
              <Spinner /> Chargement des données on-chain...
            </div>
          ) : explorerEvents.length === 0 ? (
            <div className="explorer-empty">Aucun vote enregistré sur la blockchain pour l'instant.</div>
          ) : (
            <div className="table-wrapper">
              <table className="explorer-table">
                <thead>
                  <tr>
                    <th className="explorer-th">Tx Hash</th>
                    <th className="explorer-th">Bloc</th>
                    <th className="explorer-th">Votant</th>
                    <th className="explorer-th">Candidat</th>
                    <th className="explorer-th">Heure</th>
                  </tr>
                </thead>
                <tbody>
                  {explorerEvents.map((e, i) => (
                    <tr key={i} className="explorer-tr" onClick={() => openModal(e)} style={{ cursor: 'pointer' }}>
                      <td className="explorer-td td-hash">{e.hash}</td>
                      <td className="explorer-td">{e.blockNumber}</td>
                      <td className="explorer-td td-voter">
                        {e.voter.slice(0, 10)}...{e.voter.slice(-6)}
                      </td>
                      <td className="explorer-td td-candidat">{e.candidateName}</td>
                      <td className="explorer-td td-heure">{fmt(e.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="footer">
        Contrat déployé sur Ethereum Sepolia &nbsp;·&nbsp;
        <span className="footer-accent">{CONTRACT_ADDRESS}</span>
      </footer>

      {/* ── Modal bloc ── */}
      <BlockModal
        data={modalData}
        loading={modalLoading}
        onClose={() => { setModalData(null); setModalLoading(false) }}
        onNavigate={navigateModal}
        voteBlocks={voteBlocks}
      />

    </div>
  )
}

export default App
