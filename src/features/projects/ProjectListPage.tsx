import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGuideStore } from '@/store'
import { Button } from '@/components/ui/Button'

/** 별 아이콘 (북마크 가이드 토글) */
function StarIcon({ filled, onClick }: { filled: boolean; onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      title={filled ? '북마크 가이드 해제' : '북마크 가이드로 등록 (새 프로젝트 생성 시 불러오기 가능)'}
      style={{ padding: 4, border: 'none', background: 'none', cursor: 'pointer', color: filled ? '#f59e0b' : 'var(--color-text-muted)', fontSize: 18, lineHeight: 1 }}
      aria-label={filled ? '북마크 해제' : '북마크'}
    >
      {filled ? '★' : '☆'}
    </button>
  )
}

export function ProjectListPage() {
  const navigate = useNavigate()
  const projects = useGuideStore((s) => s.projects)
  const bookmarkGuideProjects = projects.filter((p) => p.isBookmarkGuide)
  const addProject = useGuideStore((s) => s.addProject)
  const updateProjectMeta = useGuideStore((s) => s.updateProjectMeta)
  const removeProject = useGuideStore((s) => s.removeProject)
  const [showForm, setShowForm] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [participants, setParticipants] = useState<string[]>([])
  const [newParticipant, setNewParticipant] = useState('')
  const [selectedGuideIds, setSelectedGuideIds] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleGuide(guideId: string) {
    setSelectedGuideIds((prev) =>
      prev.includes(guideId) ? prev.filter((id) => id !== guideId) : [...prev, guideId]
    )
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setCoverImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function addParticipant() {
    const trimmed = newParticipant.trim()
    if (trimmed) {
      setParticipants((prev) => [...prev, trimmed])
      setNewParticipant('')
    }
  }

  function removeParticipant(index: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== index))
  }

  function openEditForm(project: {
    id: string
    name: string
    coverImage?: string
    participants?: string[]
  }) {
    setEditingProjectId(project.id)
    setName(project.name)
    setCoverImage(project.coverImage ?? null)
    setParticipants([...(project.participants ?? [])])
    setNewParticipant('')
    setShowForm(true)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      alert('프로젝트 이름을 입력해 주세요.')
      return
    }
    const list = participants.filter(Boolean)
    if (editingProjectId) {
      updateProjectMeta(editingProjectId, {
        name: trimmedName,
        coverImage: coverImage ?? undefined,
        participants: list.length ? list : undefined,
      })
      setShowForm(false)
      setEditingProjectId(null)
      setName('')
      setCoverImage(null)
      setParticipants([])
    } else {
      const id = addProject(trimmedName, {
        coverImage: coverImage ?? undefined,
        participants: list.length ? list : undefined,
        selectedGuideIds: selectedGuideIds.length ? selectedGuideIds : undefined,
      })
      setShowForm(false)
      setName('')
      setCoverImage(null)
      setParticipants([])
      setSelectedGuideIds([])
      navigate(`/projects/${id}`)
    }
  }

  function handleCancel() {
    setShowForm(false)
    setEditingProjectId(null)
    setName('')
    setCoverImage(null)
    setParticipants([])
    setSelectedGuideIds([])
  }

  function handleOpenProject(id: string) {
    navigate(`/projects/${id}`)
  }

  function handleDeleteProject(e: React.MouseEvent, projectId: string, projectName: string) {
    e.stopPropagation()
    if (!window.confirm(`"${projectName}" 프로젝트를 삭제할까요? 삭제된 프로젝트는 복구할 수 없습니다.`)) return
    removeProject(projectId)
    navigate('/projects')
  }

  return (
    <div style={{ minHeight: '100vh', padding: 48, background: 'var(--color-bg)' }}>
      <header style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>프로젝트</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            onClick={() => {
              setEditingProjectId(null)
              setShowForm(true)
              setName('')
              setCoverImage(null)
              setParticipants([])
              setSelectedGuideIds([])
            }}
          >
            + 새 프로젝트
          </Button>
        </div>
      </header>

      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}
          onClick={(e) => e.target === e.currentTarget && handleCancel()}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, maxHeight: '90vh', overflow: 'auto', background: 'var(--color-surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', padding: 24 }}
          >
            <h2 style={{ margin: '0 0 20px', fontSize: 22, fontWeight: 600 }}>
              {editingProjectId ? '프로젝트 편집' : '새 프로젝트 등록'}
            </h2>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>프로젝트 이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="프로젝트 이름"
                autoFocus
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>비주얼 이미지</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                  이미지 선택
                </Button>
                {coverImage && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 80, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                      <img src={coverImage} alt="미리보기" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <Button type="button" variant="ghost" size="s" onClick={() => setCoverImage(null)}>
                      이미지 제거
                    </Button>
                  </div>
                )}
              </div>
            </div>
            {!editingProjectId && bookmarkGuideProjects.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  가이드 불러오기 (파일 구조·리소스·카테고리·컴포넌트 그대로 복사)
                </label>
                <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', padding: 8, background: 'var(--color-bg)' }}>
                  {bookmarkGuideProjects.map((proj) => (
                    <label
                      key={proj.id}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 14 }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGuideIds.includes(proj.id)}
                        onChange={() => toggleGuide(proj.id)}
                      />
                      <span>{proj.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)' }}>참여자 (여러 명)</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  type="text"
                  value={newParticipant}
                  onChange={(e) => setNewParticipant(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addParticipant())}
                  placeholder="이름 입력 후 추가"
                  style={{ flex: 1, minWidth: 0, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', fontSize: 14 }}
                />
                <Button type="button" variant="secondary" onClick={addParticipant}>
                  추가
                </Button>
              </div>
              {participants.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {participants.map((p, i) => (
                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'rgba(37,99,235,0.1)', borderRadius: 999, fontSize: 14 }}>
                      {p}
                      <button
                        type="button"
                        onClick={() => removeParticipant(i)}
                        style={{ padding: 0, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: 14 }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                취소
              </Button>
              <Button type="submit" variant="primary">
                {editingProjectId ? '저장' : '등록'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {projects.length === 0 && !showForm ? (
        <div style={{ padding: 48, textAlign: 'center', background: 'var(--color-surface)', borderRadius: 'var(--radius)', border: '1px dashed var(--color-border)' }}>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--color-text-muted)' }}>등록된 프로젝트가 없습니다.</p>
          <Button variant="primary" onClick={() => setShowForm(true)}>
            첫 프로젝트 만들기
          </Button>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {projects.map((p) => (
            <li key={p.id}>
              <div style={{ width: '100%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden', position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => handleOpenProject(p.id)}
                  style={{ width: '100%', padding: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}
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
                  <div
                    data-card-body
                    style={{ width: '100%', border: '1px solid transparent', borderRadius: 'var(--radius)', transition: 'border-color .15s, background .15s' }}
                  >
                    <div
                      style={{
                        width: '100%',
                        height: 160,
                        background: p.coverImage ? `url(${p.coverImage}) center/cover` : 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-border) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {!p.coverImage && <span style={{ fontSize: 48, color: 'var(--color-text-muted)', opacity: 0.5 }}>📁</span>}
                    </div>
                    <div style={{ padding: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <StarIcon
                          filled={p.isBookmarkGuide ?? false}
                          onClick={() => updateProjectMeta(p.id, { isBookmarkGuide: !p.isBookmarkGuide })}
                        />
                        {p.name}
                      </div>
                      {p.participants && p.participants.length > 0 ? (
                        <div style={{ fontSize: 14, color: 'var(--color-text-muted)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {p.participants.map((who, i) => (
                            <span key={i} style={{ padding: '2px 8px', background: 'rgba(37,99,235,0.08)', borderRadius: 4, fontSize: 14 }}>
                              {who}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>참여자 없음</div>
                      )}
                    </div>
                  </div>
                </button>
                <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="s"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEditForm(p)
                    }}
                  >
                    편집
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="s"
                    onClick={(e) => handleDeleteProject(e, p.id, p.name)}
                    title="프로젝트 삭제"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
