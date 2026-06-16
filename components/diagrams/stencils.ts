// Pre-built shape stencils for the Excalidraw architecture diagram editor.
// Each stencil factory returns an array of Excalidraw-compatible element objects.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = Record<string, any>;

const uid = () =>
  `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
const rng = () => Math.floor(Math.random() * 999999);
const ts = () => Date.now();

function baseEl(
  type: string,
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
  fill: string,
  extra: Partial<El> = {}
): El {
  return {
    id: uid(),
    type,
    x, y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: stroke,
    backgroundColor: fill,
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: rng(),
    version: 1,
    versionNonce: rng(),
    updated: ts(),
    link: null,
    locked: false,
    boundElements: null,
    ...extra,
  };
}

function textEl(
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  containerId: string,
  color = "#1e1e2e"
): El {
  return {
    id: uid(),
    type: "text",
    x, y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: color,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness: null,
    seed: rng(),
    version: 1,
    versionNonce: rng(),
    updated: ts(),
    link: null,
    locked: false,
    boundElements: null,
    containerId,
    text: content,
    originalText: content,
    fontSize: 13,
    fontFamily: 2,
    textAlign: "center",
    verticalAlign: "middle",
    baseline: 13,
    autoResize: true,
    lineHeight: 1.25,
  };
}

function labeledShape(
  shapeType: "rectangle" | "ellipse" | "diamond",
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  stroke: string,
  fill: string,
  extra: Partial<El> = {}
): El[] {
  const shapeId = uid();
  const textId = uid();

  const shape = baseEl(shapeType, x, y, w, h, stroke, fill, {
    ...extra,
    id: shapeId,
    boundElements: [{ id: textId, type: "text" }],
  });

  const txt = textEl(x, y, w, h, label, shapeId);
  txt.id = textId;

  return [shape, txt];
}

export type StencilItem = {
  id: string;
  label: string;
  emoji: string;
  createElement: (x: number, y: number) => El[];
};

export type StencilGroup = {
  title: string;
  items: StencilItem[];
};

export const STENCIL_GROUPS: StencilGroup[] = [
  {
    title: "General",
    items: [
      {
        id: "app",
        label: "Application",
        emoji: "📦",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 80, "Application", "#1971c2", "#e7f5ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "service",
        label: "Service",
        emoji: "⚙️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Service", "#2f9e44", "#ebfbee", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "database",
        label: "Database",
        emoji: "🗄️",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 140, 80, "Database", "#7950f2", "#f3f0ff"),
      },
      {
        id: "server",
        label: "Server",
        emoji: "🖥️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Server", "#495057", "#f8f9fa"),
      },
      {
        id: "cloud",
        label: "Cloud / Internet",
        emoji: "☁️",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 200, 100, "Internet", "#0c8599", "#e3fafc", {
            strokeStyle: "dashed",
          }),
      },
      {
        id: "user",
        label: "User / Person",
        emoji: "👤",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "User", "#e67700", "#fff9db"),
      },
      {
        id: "firewall",
        label: "Firewall",
        emoji: "🔥",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 160, 80, "Firewall", "#c92a2a", "#fff5f5"),
      },
      {
        id: "queue",
        label: "Message Queue",
        emoji: "📬",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Queue", "#862e9c", "#f8f0fc", {
            strokeStyle: "dashed",
            roundness: { type: 3, value: 4 },
          }),
      },
    ],
  },
  {
    title: "AWS",
    items: [
      {
        id: "aws-ec2",
        label: "EC2",
        emoji: "🟠",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 60, "EC2", "#e07b39", "#fef3ea", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "aws-s3",
        label: "S3",
        emoji: "🟢",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 60, "S3", "#3d7d41", "#edf7ee", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "aws-rds",
        label: "RDS",
        emoji: "🔵",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 140, 80, "RDS", "#1a6fb0", "#e8f4fd"),
      },
      {
        id: "aws-lambda",
        label: "Lambda",
        emoji: "λ",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 140, 80, "Lambda", "#e08a1e", "#fef9ea"),
      },
      {
        id: "aws-vpc",
        label: "VPC",
        emoji: "🔷",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 240, 160, "VPC", "#1a6fb0", "transparent", {
            strokeStyle: "dashed",
            strokeWidth: 1,
          }),
      },
      {
        id: "aws-alb",
        label: "Load Balancer",
        emoji: "⚖️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Load Balancer", "#e07b39", "#fef3ea", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "aws-apigw",
        label: "API Gateway",
        emoji: "🌐",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "API Gateway", "#c46210", "#fdf0e6", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "aws-cloudfront",
        label: "CloudFront",
        emoji: "🌩️",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 160, 80, "CloudFront", "#0c8599", "#e3fafc"),
      },
      {
        id: "aws-sqs",
        label: "SQS",
        emoji: "📨",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 60, "SQS", "#862e9c", "#f8f0fc", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "aws-sns",
        label: "SNS",
        emoji: "📢",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 60, "SNS", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 4 },
          }),
      },
    ],
  },
  {
    title: "Labels",
    items: [
      {
        id: "text-label",
        label: "Text Label",
        emoji: "🔤",
        createElement: (x, y) => [
          {
            ...baseEl("text", x, y, 160, 30, "#1e1e2e", "transparent"),
            boundElements: null,
            containerId: null,
            text: "Label",
            originalText: "Label",
            fontSize: 16,
            fontFamily: 2,
            textAlign: "left",
            verticalAlign: "middle",
            baseline: 16,
            autoResize: true,
            lineHeight: 1.25,
          },
        ],
      },
    ],
  },
];
