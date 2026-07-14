import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, Col, Form, Modal, Row } from 'react-bootstrap';
import LabelWithInfo from '../common/LabelWithInfo';
import IconActionButton from '../common/IconActionButton';
import type { ThemePalette } from '../../theme';
import { customThemeSeed, predefinedThemes } from '../../theme';

type ThemeCustomizerModalProps = {
  show: boolean;
  activeThemeId: string;
  activeThemeName: string;
  onHide: () => void;
  onApplyTheme: (theme: ThemePalette) => void;
};

function cloneTheme(theme: ThemePalette): ThemePalette {
  return { ...theme };
}

function ThemeCustomizerModal({
  show,
  activeThemeId,
  activeThemeName,
  onHide,
  onApplyTheme,
}: ThemeCustomizerModalProps) {
  const [customTheme, setCustomTheme] = useState<ThemePalette>(cloneTheme(customThemeSeed));

  useEffect(() => {
    if (!show) {
      return;
    }

    const stored = localStorage.getItem('ipoc.customTheme');
    if (!stored) {
      setCustomTheme(cloneTheme(customThemeSeed));
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<ThemePalette>;
      setCustomTheme({ ...customThemeSeed, ...parsed, id: 'custom', name: 'Custom Theme' });
    } catch {
      setCustomTheme(cloneTheme(customThemeSeed));
    }
  }, [show]);

  const previewStyle = useMemo(() => ({
    background: `linear-gradient(135deg, ${customTheme.navbarStart}, ${customTheme.navbarEnd})`,
    color: '#ffffff',
    borderRadius: 7,
    padding: '0.35rem 0.6rem',
    fontSize: '0.72rem',
    fontWeight: 600,
  }), [customTheme.navbarEnd, customTheme.navbarStart]);

  const handleCustomColorChange = (field: keyof ThemePalette, value: string) => {
    setCustomTheme((current) => ({ ...current, [field]: value }));
  };

  const applyCustomTheme = () => {
    const nextTheme = { ...customTheme, id: 'custom', name: 'Custom Theme' };
    localStorage.setItem('ipoc.customTheme', JSON.stringify(nextTheme));
    onApplyTheme(nextTheme);
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>Theme Studio</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="mb-3 d-flex align-items-center justify-content-between">
          <div>
            <div className="fw-semibold">Select a preset or build a custom palette.</div>
            <div className="text-muted small">Current theme: {activeThemeName}</div>
          </div>
          <Badge bg="secondary">Active ID: {activeThemeId}</Badge>
        </div>

        <Row className="g-2 mb-4">
          {predefinedThemes.map((theme) => (
            <Col md={4} lg={3} key={theme.id}>
              <Card className="h-100 shadow-sm ipoc-theme-tile-card">
                <Card.Body className="p-2">
                  <div className="d-flex align-items-start justify-content-between mb-1">
                    <div className="fw-semibold ipoc-theme-tile-title" title={theme.name}>{theme.name}</div>
                    {activeThemeId === theme.id && <Badge bg="secondary" className="ipoc-theme-tile-badge">On</Badge>}
                  </div>
                  <div className="small text-muted mb-2 ipoc-theme-tile-description" title={theme.description}>{theme.description}</div>
                  <div className="d-flex gap-1 mb-2">
                    {[theme.primary, theme.secondary, theme.accent, theme.background].map((swatch) => (
                      <div
                        key={`${theme.id}-${swatch}`}
                        className="ipoc-theme-tile-swatch"
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                  </div>
                  <IconActionButton
                    iconClassName="bi bi-palette"
                    tooltip={`Apply ${theme.name} theme`}
                    ariaLabel={`Apply ${theme.name} theme`}
                    onClick={() => onApplyTheme(theme)}
                    variant="outline-secondary"
                  />
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>

        <Card className="shadow-sm">
          <Card.Header className="fw-semibold">Custom Theme Builder</Card.Header>
          <Card.Body>
            <Row className="g-3">
              <Col md={4}>
                <Form.Label><LabelWithInfo text="Primary" info="Primary brand color used for major action emphasis and highlights." /></Form.Label>
                <Form.Control type="color" value={customTheme.primary} onChange={(e) => handleCustomColorChange('primary', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label><LabelWithInfo text="Secondary" info="Secondary UI color used for supporting accents and controls." /></Form.Label>
                <Form.Control type="color" value={customTheme.secondary} onChange={(e) => handleCustomColorChange('secondary', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label><LabelWithInfo text="Accent" info="Accent color used for key visual highlights across cards and indicators." /></Form.Label>
                <Form.Control type="color" value={customTheme.accent} onChange={(e) => handleCustomColorChange('accent', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label><LabelWithInfo text="Surface" info="Base color for elevated surfaces such as cards and panels." /></Form.Label>
                <Form.Control type="color" value={customTheme.surface} onChange={(e) => handleCustomColorChange('surface', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label><LabelWithInfo text="Background" info="Application page background color." /></Form.Label>
                <Form.Control type="color" value={customTheme.background} onChange={(e) => handleCustomColorChange('background', e.target.value)} />
              </Col>
              <Col md={4}>
                <Form.Label><LabelWithInfo text="Text" info="Primary text color used across the application." /></Form.Label>
                <Form.Control type="color" value={customTheme.text} onChange={(e) => handleCustomColorChange('text', e.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label><LabelWithInfo text="Navbar Gradient Start" info="Starting color of the navigation/header gradient." /></Form.Label>
                <Form.Control type="color" value={customTheme.navbarStart} onChange={(e) => handleCustomColorChange('navbarStart', e.target.value)} />
              </Col>
              <Col md={6}>
                <Form.Label><LabelWithInfo text="Navbar Gradient End" info="Ending color of the navigation/header gradient." /></Form.Label>
                <Form.Control type="color" value={customTheme.navbarEnd} onChange={(e) => handleCustomColorChange('navbarEnd', e.target.value)} />
              </Col>
            </Row>

            <div className="mt-3" style={previewStyle}>Theme preview header</div>

            <div className="mt-3 d-flex gap-2">
              <IconActionButton
                iconClassName="bi bi-check2-circle"
                tooltip="Apply custom theme"
                ariaLabel="Apply custom theme"
                onClick={applyCustomTheme}
                variant="secondary"
              />
              <IconActionButton
                iconClassName="bi bi-arrow-counterclockwise"
                tooltip="Reset custom theme values"
                ariaLabel="Reset custom theme values"
                onClick={() => setCustomTheme(cloneTheme(customThemeSeed))}
                variant="outline-secondary"
              />
            </div>
          </Card.Body>
        </Card>
      </Modal.Body>
    </Modal>
  );
}

export default ThemeCustomizerModal;
