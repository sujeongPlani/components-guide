import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGuideStore } from '@/store'
import type { Project } from '@/store/types'
import { Button } from '@/components/ui/Button'

const SECTION_STYLE = { marginBottom: 40 }
const SECTION_TITLE_STYLE = { margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: 'var(--color-text-muted)' }
const CARD_GRID_STYLE: React.CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/'
const KRDS_COVER = `${BASE}logos/krds-cover.png`
const MXDS_COVER = `${BASE}logos/mxds-cover.png`

const CUSTOM_THUMB_URLS = [1, 2, 3, 4, 5].map((i) => `${BASE}logos/custom-thumb-${i}.png`)
const CUSTOM_THUMB_FOR_MODAL = CUSTOM_THUMB_URLS[2]

function getCustomThumbForProject(projectId: string): string {
  let n = 0
  for (let i = 0; i < projectId.length; i++) n = (n << 5) - n + projectId.charCodeAt(i)
  const idx = Math.abs(n) % CUSTOM_THUMB_URLS.length
  return CUSTOM_THUMB_URLS[idx]
}

const CREATE_OPTION_THUMB = { width: 100, height: 56 }
const createOptionButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 0,
  borderRadius: 'var(--radius)',
  border: '2px solid var(--color-border)',
  overflow: 'hidden',
  background: 'var(--color-surface)',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  boxSizing: 'border-box',
  minHeight: CREATE_OPTION_THUMB.height,
}

function getTemplateCover(p: Project, systemKind?: 'krds' | 'mxds'): string | null {
  if (p.type !== 'systemTemplate') return null
  if (systemKind === 'krds' || (!systemKind && p.name === 'KRDS')) return KRDS_COVER
  if (systemKind === 'mxds' || (!systemKind && p.name === 'MXDS')) return MXDS_COVER
  return null
}

function ProjectCard({
  p,
  onOpen,
  onEdit,
  onEditSystemTemplate,
  onUseAsTemplate,
  showEditDelete,
  systemKind,
}: {
  p: Project
  onOpen: (id: string) => void
  onEdit?: (p: Project) => void
  onEditSystemTemplate?: (kind: 'krds' | 'mxds') => void
  onUseAsTemplate?: (id: string) => void
  showEditDelete: boolean
  systemKind?: 'krds' | 'mxds'
}) {
  return (
    <li>
      <div style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', position: 'relative' }}>
        <button
          type="button"
          onClick={() => onOpen(p.id)}
          style={{ width: '100%', padding: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', outline: 'none' }}
          onMouseEnter={(e) => {
            const card = e.currentTarget.closest('li')?.querySelector('[data-card-body]') as HTMLElement
            if (card) {
              card.style.borderColor = 'var(--color-primary)'
              card.style.background = 'rgba(37,99,235,0.04)'
            }
          }}
          onMouseLeave={(e) => {
            const card = e.currentTarget.closest('li')?.querySelector('[data-card-body]') as HTMLElement
            if (card) {
              card.style.borderColor = ''
              card.style.background = ''
            }
          }}
        >
          <div data-card-body style={{ width: '100%', transition: 'background .15s' }}>
            <div
              style={{
                width: '100%',
                height: 160,
                background: (() => {
                  const cover = getTemplateCover(p, systemKind)
                  if (cover) return `url(${cover}) center/cover`
                  if (p.coverImage) return `url(${p.coverImage}) center/cover`
                  return `url(${getCustomThumbForProject(p.id)}) center/cover`
                })(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <div style={{ padding: 16, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              {p.type === 'project' && p.participants && p.participants.length > 0 && (
                <div style={{ fontSize: 14, color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {p.participants.map((who, i) => (
                    <span key={i} style={{ padding: '2px 8px', background: 'rgba(37,99,235,0.08)', borderRadius: 4, fontSize: 14 }}>{who}</span>
                  ))}
                </div>
              )}
              {p.type === 'project' && (!p.participants || p.participants.length === 0) && <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>참여자 없음</div>}
            </div>
          </div>
        </button>
        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {onUseAsTemplate && (
            <Button type="button" variant="primary" size="s" onClick={(e) => { e.stopPropagation(); onUseAsTemplate(p.id) }}>
              이 템플릿으로 만들기
            </Button>
          )}
          {showEditDelete && (onEdit || onEditSystemTemplate) && (
            <Button
              type="button"
              variant="secondary"
              size="s"
              onClick={(e) => {
                e.stopPropagation()
                if (onEditSystemTemplate && p.type === 'systemTemplate' && systemKind) onEditSystemTemplate(systemKind)
                else if (onEdit && (p.type === 'project' || p.type === 'userTemplate')) onEdit(p)
              }}
            >
              편집
            </Button>
          )}
        </div>
      </div>
    </li>
  )
}

export function ProjectListPage() {
  const navigate = useNavigate()
  const projects = useGuideStore((s) => s.projects)
  const getSystemTemplates = useGuideStore((s) => s.getSystemTemplates)
  const addProject = useGuideStore((s) => s.addProject)
  const addProjectFromTemplate = useGuideStore((s) => s.addProjectFromTemplate)
  const updateProjectMeta = useGuideStore((s) => s.updateProjectMeta)
  const removeProject = useGuideStore((s) => s.removeProject)

  const systemTemplates = getSystemTemplates()
  const userTemplates = projects.filter((p) => p.type === 'userTemplate')
  const userProjects = projects.filter((p) => p.type === 'project')

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createStep, setCreateStep] = useState<'choose' | 'name'>('choose')
  const [createSource, setCreateSource] = useState<'empty' | 'krds' | 'mxds' | string>('empty')
  const [createName, setCreateName] = useState('')
  const [createParticipants, setCreateParticipants] = useState<string[]>([])
  const [createParticipantInput, setCreateParticipantInput] = useState('')
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCoverImage, setEditCoverImage] = useState<string | null>(null)
  const [editParticipants, setEditParticipants] = useState<string[]>([])
  const [editParticipantInput, setEditParticipantInput] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const systemCoverInputRef = useRef<HTMLInputElement>(null)

  function handleCreateFrom(source: 'empty' | 'krds' | 'mxds' | string) {
    setCreateSource(source)
    setCreateName('')
    setCreateParticipants([])
    setCreateParticipantInput('')
    setCreateStep('name')
  }

  function addCreateParticipant() {
    const name = createParticipantInput.trim()
    if (!name || createParticipants.includes(name)) return
    setCreateParticipants((prev) => [...prev, name])
    setCreateParticipantInput('')
  }

  function removeCreateParticipant(name: string) {
    setCreateParticipants((prev) => prev.filter((p) => p !== name))
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = createName.trim() || (createSource === 'krds' ? 'KRDS 복사본' : createSource === 'mxds' ? 'MXDS 복사본' : '새 프로젝트')
    const participants = createParticipants.length ? createParticipants : undefined
    let id: string
    if (createSource === 'empty') {
      id = addProject(name, { participants })
    } else if (createSource === 'krds') {
      id = addProjectFromTemplate('krds', name, { participants })
    } else if (createSource === 'mxds') {
      id = addProjectFromTemplate('mxds', name, { participants })
    } else {
      id = addProjectFromTemplate(createSource, name, { participants })
    }
    if (id) {
      setShowCreateModal(false)
      setCreateStep('choose')
      setCreateSource('empty')
      setCreateParticipants([])
      navigate(`/projects/${id}`)
    }
  }

  function handleOpenProject(id: string) {
    navigate(`/projects/${id}`)
  }

  function addEditParticipant() {
    const name = editParticipantInput.trim()
    if (!name || editParticipants.includes(name)) return
    setEditParticipants((prev) => [...prev, name])
    setEditParticipantInput('')
  }

  function removeEditParticipant(name: string) {
    setEditParticipants((prev) => prev.filter((p) => p !== name))
  }

  function openEditForm(project: Project) {
    if (project.type !== 'project' && project.type !== 'userTemplate') return
    setEditingProjectId(project.id)
    setEditName(project.name)
    setEditCoverImage(project.coverImage ?? null)
    setEditParticipants([...(project.participants ?? [])])
    setEditParticipantInput('')
  }

  const [editingSystemKind, setEditingSystemKind] = useState<'krds' | 'mxds' | null>(null)
  const [editSystemName, setEditSystemName] = useState('')
  const [editSystemDescription, setEditSystemDescription] = useState('')
  const [editSystemCoverImage, setEditSystemCoverImage] = useState<string | null>(null)
  const setSystemTemplateMeta = useGuideStore((s) => s.setSystemTemplateMeta)

  function openEditSystemForm(kind: 'krds' | 'mxds') {
    const templates = getSystemTemplates()
    const p = templates[kind === 'krds' ? 0 : 1]
    setEditingSystemKind(kind)
    setEditSystemName(p.name)
    setEditSystemDescription(p.description ?? '')
    setEditSystemCoverImage(p.coverImage ?? null)
  }

  function handleEditSystemSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingSystemKind) return
    setSystemTemplateMeta(editingSystemKind, {
      name: editSystemName.trim() || undefined,
      description: editSystemDescription.trim() || undefined,
      coverImage: editSystemCoverImage ?? undefined,
    })
    setEditingSystemKind(null)
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingProjectId) return
    updateProjectMeta(editingProjectId, {
      name: editName.trim() || '프로젝트',
      coverImage: editCoverImage ?? undefined,
      participants: editParticipants.length ? editParticipants : undefined,
    })
    setEditingProjectId(null)
  }

  return (
    <div style={{ minHeight: '100vh', padding: 48, background: 'var(--color-bg)' }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>프로젝트</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              setShowCreateModal(true)
              setCreateStep('choose')
              setCreateSource('empty')
              setCreateName('')
            }}
          >
            + 새 프로젝트
          </Button>
        </div>
      </header>

      {/* 1) 기본 템플릿 */}
      <section style={SECTION_STYLE}>
        <h2 style={{ ...SECTION_TITLE_STYLE, fontSize: 20, color: 'var(--color-text)', borderBottom: '2px solid var(--color-primary)', paddingBottom: 8 }}>
          기본 템플릿
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
          기준 가이드입니다. 이름·설명·커버 이미지는 편집할 수 있으며, 이 템플릿으로 새 프로젝트를 만들 수 있습니다.
        </p>
        <ul style={CARD_GRID_STYLE}>
          {systemTemplates.map((p, idx) => (
            <ProjectCard
              key={p.id}
              p={p}
              systemKind={idx === 0 ? 'krds' : 'mxds'}
              onOpen={handleOpenProject}
              onEditSystemTemplate={openEditSystemForm}
              onUseAsTemplate={() => {
                setShowCreateModal(true)
                setCreateSource(idx === 0 ? 'krds' : 'mxds')
                setCreateStep('name')
                setCreateName('')
              }}
              showEditDelete={true}
            />
          ))}
        </ul>
      </section>

      {/* 2) 내 템플릿 */}
      {userTemplates.length > 0 && (
        <section style={SECTION_STYLE}>
          <h2 style={SECTION_TITLE_STYLE}>내 템플릿</h2>
          <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
            프로젝트에서 저장한 템플릿입니다. 이름·커버 등 메타를 편집할 수 있으며, 이 템플릿으로 새 프로젝트를 만들 수 있습니다.
          </p>
          <ul style={CARD_GRID_STYLE}>
            {userTemplates.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                onOpen={handleOpenProject}
                onEdit={openEditForm}
                onUseAsTemplate={(id) => {
                  setShowCreateModal(true)
                  setCreateSource(id)
                  setCreateStep('name')
                  setCreateName('')
                }}
                showEditDelete={true}
              />
            ))}
          </ul>
        </section>
      )}

      {/* 3) 내 프로젝트 */}
      <section style={SECTION_STYLE}>
        <h2 style={SECTION_TITLE_STYLE}>내 프로젝트</h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text-muted)' }}>
          직접 작업하는 프로젝트입니다. 편집·삭제·템플릿 저장이 가능합니다.
        </p>
        {userProjects.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px dashed var(--color-border)' }}>
            <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--color-text-muted)' }}>등록된 프로젝트가 없습니다.</p>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>첫 프로젝트 만들기</Button>
          </div>
        ) : (
          <ul style={CARD_GRID_STYLE}>
            {userProjects.map((p) => (
              <ProjectCard
                key={p.id}
                p={p}
                onOpen={handleOpenProject}
                onEdit={openEditForm}
                showEditDelete={true}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 새 프로젝트 모달 */}
      {showCreateModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
          onClick={(e) => e.target === e.currentTarget && (setShowCreateModal(false), setCreateStep('choose'))}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflow: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24 }}
          >
            {createStep === 'choose' ? (
              <>
                <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>새 프로젝트 만들기</h2>
                <p style={{ margin: '0 0 16px', fontSize: 16, color: 'var(--color-text-muted)'}}>어떤 방식으로 만들까요?</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button type="button" onClick={() => handleCreateFrom('empty')} style={createOptionButtonStyle}>
                    <img src={CUSTOM_THUMB_FOR_MODAL} alt="" style={{ ...CREATE_OPTION_THUMB, objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)', padding: '0 14px' }}>커스텀 프로젝트</span>
                  </button>
                  <button type="button" onClick={() => handleCreateFrom('krds')} style={createOptionButtonStyle}>
                    <img src={KRDS_COVER} alt="KRDS" style={{ ...CREATE_OPTION_THUMB, objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)', padding: '0 14px' }}>KRDS 기반</span>
                  </button>
                  <button type="button" onClick={() => handleCreateFrom('mxds')} style={createOptionButtonStyle}>
                    <img src={MXDS_COVER} alt="MXDS" style={{ ...CREATE_OPTION_THUMB, objectFit: 'cover', flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text)', padding: '0 14px' }}>MXDS 기반</span>
                  </button>
                  {userTemplates.length > 0 && (
                    <>
                      <div style={{ borderTop: '1px solid var(--color-border)', margin: '8px 0', paddingTop: 12 }}>
                        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>내 템플릿</span>
                      </div>
                      {userTemplates.map((t) => (
                        <Button key={t.id} variant="secondary" style={{ justifyContent: 'flex-start', padding: 14 }} onClick={() => handleCreateFrom(t.id)}>
                          {t.name}
                        </Button>
                      ))}
                    </>
                  )}
                </div>
                <div style={{ marginTop: 20 }}>
                  <Button variant="ghost" onClick={() => setShowCreateModal(false)}>취소</Button>
                </div>
              </>
            ) : (
              <form onSubmit={handleCreateSubmit}>
                <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>프로젝트 이름</h2>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>이름</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder={createSource === 'empty' ? '프로젝트 이름' : createSource === 'krds' ? 'KRDS 복사본' : createSource === 'mxds' ? 'MXDS 복사본' : '프로젝트 이름'}
                    autoFocus
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>참여자</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)' }}>
                    {createParticipants.map((name) => (
                      <span
                        key={name}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(37,99,235,0.12)', borderRadius: 6, fontSize: 13,
                        }}
                      >
                        {name}
                        <button
                          type="button"
                          onClick={() => removeCreateParticipant(name)}
                          style={{ padding: 0, margin: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1 }}
                          aria-label={`${name} 제거`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={createParticipantInput}
                      onChange={(e) => setCreateParticipantInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCreateParticipant() } }}
                      placeholder="이름 입력 후 Enter"
                      style={{ flex: 1, minWidth: 120, padding: '4px 0', border: 'none', background: 'none', fontSize: 14, outline: 'none', color: 'var(--color-text)' }}
                    />
                  </div>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>여러 명을 추가할 수 있습니다. 입력 후 Enter를 누르세요.</p>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <Button type="button" variant="ghost" onClick={() => setCreateStep('choose')}>뒤로</Button>
                  <Button type="submit" variant="primary">만들기</Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* 기본 템플릿 메타 편집 모달 */}
      {editingSystemKind && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
          onClick={(e) => e.target === e.currentTarget && setEditingSystemKind(null)}
        >
          <form
            onSubmit={handleEditSystemSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'var(--color-surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24 }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>기본 템플릿 편집 ({editingSystemKind === 'krds' ? 'KRDS' : 'MXDS'})</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>이름</label>
              <input
                type="text"
                value={editSystemName}
                onChange={(e) => setEditSystemName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>설명</label>
              <textarea
                value={editSystemDescription}
                onChange={(e) => setEditSystemDescription(e.target.value)}
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>비주얼 이미지</label>
              <input
                ref={systemCoverInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) {
                    const r = new FileReader()
                    r.onload = () => setEditSystemCoverImage(r.result as string)
                    r.readAsDataURL(f)
                  }
                  e.target.value = ''
                }}
              />
              <Button type="button" variant="secondary" onClick={() => systemCoverInputRef.current?.click()}>이미지 선택</Button>
              {editSystemCoverImage && (
                <Button type="button" variant="ghost" size="s" onClick={() => setEditSystemCoverImage(null)} style={{ marginLeft: 8 }}>제거</Button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={() => setEditingSystemKind(null)}>취소</Button>
              <Button type="submit" variant="primary">저장</Button>
            </div>
          </form>
        </div>
      )}

      {/* 프로젝트 편집 모달 (내 프로젝트·내 템플릿) */}
      {editingProjectId && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
          onClick={(e) => e.target === e.currentTarget && setEditingProjectId(null)}
        >
          <form
            onSubmit={handleEditSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'var(--color-surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24 }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>프로젝트 편집</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>이름</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>비주얼 이미지</label>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { const r = new FileReader(); r.onload = () => setEditCoverImage(r.result as string); r.readAsDataURL(f) }; e.target.value = '' }} />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>이미지 선택</Button>
              {editCoverImage && <Button type="button" variant="ghost" size="s" onClick={() => setEditCoverImage(null)} style={{ marginLeft: 8 }}>제거</Button>}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>참여자</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', background: 'var(--color-bg)' }}>
                {editParticipants.map((name) => (
                  <span
                    key={name}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'rgba(37,99,235,0.12)', borderRadius: 6, fontSize: 13,
                    }}
                  >
                    {name}
                    <button
                      type="button"
                      onClick={() => removeEditParticipant(name)}
                      style={{ padding: 0, margin: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14, lineHeight: 1 }}
                      aria-label={`${name} 제거`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={editParticipantInput}
                  onChange={(e) => setEditParticipantInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditParticipant() } }}
                  placeholder="이름 입력 후 Enter"
                  style={{ flex: 1, minWidth: 120, padding: '4px 0', border: 'none', background: 'none', fontSize: 14, outline: 'none', color: 'var(--color-text)' }}
                />
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>여러 명을 추가할 수 있습니다. 입력 후 Enter를 누르세요.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (!window.confirm(`"${editName}"을(를) 삭제할까요?`)) return
                  removeProject(editingProjectId)
                  setEditingProjectId(null)
                  navigate('/projects')
                }}
                style={{ color: 'var(--color-text-muted)' }}
              >
                삭제
              </Button>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button type="button" variant="ghost" onClick={() => setEditingProjectId(null)}>취소</Button>
                <Button type="submit" variant="primary">저장</Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
