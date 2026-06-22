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

  // ── People & Roles ───────────────────────────────────────────────────────
  {
    title: "People & Roles",
    items: [
      {
        id: "person",
        label: "Person",
        emoji: "👤",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "Person", "#e67700", "#fff9db"),
      },
      {
        id: "team",
        label: "Team",
        emoji: "👥",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Team", "#e67700", "#fff9db", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "executive",
        label: "Executive",
        emoji: "🧑‍💼",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Executive", "#d9480f", "#fff4e6", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "external-user",
        label: "External User",
        emoji: "🧑‍🤝‍🧑",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "External User", "#868e96", "#f8f9fa"),
      },
      {
        id: "admin",
        label: "Admin / Operator",
        emoji: "🛡️",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 140, 80, "Admin", "#c92a2a", "#fff5f5"),
      },
      {
        id: "customer",
        label: "Customer",
        emoji: "🤝",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 100, "Customer", "#2f9e44", "#ebfbee"),
      },
    ],
  },

  // ── Buildings & Places ───────────────────────────────────────────────────
  {
    title: "Buildings & Places",
    items: [
      {
        id: "office",
        label: "Office / HQ",
        emoji: "🏢",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 100, "Office / HQ", "#0c8599", "#e3fafc", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "data-centre",
        label: "Data Centre",
        emoji: "🏭",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Data Centre", "#1971c2", "#e7f5ff", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "factory",
        label: "Factory",
        emoji: "🏗️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Factory", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "hospital",
        label: "Hospital",
        emoji: "🏥",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 100, "Hospital", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "store",
        label: "Store / Retail",
        emoji: "🏪",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Store / Retail", "#2f9e44", "#ebfbee", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "branch-office",
        label: "Branch Office",
        emoji: "🏬",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Branch Office", "#0c8599", "#e3fafc", {
            roundness: { type: 3, value: 8 },
          }),
      },
    ],
  },

  // ── Organisation ─────────────────────────────────────────────────────────
  {
    title: "Organisation",
    items: [
      {
        id: "department",
        label: "Department",
        emoji: "🗂️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Department", "#7950f2", "#f3f0ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "business-unit",
        label: "Business Unit",
        emoji: "🏛️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 200, 100, "Business Unit", "#6741d9", "#f3f0ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "subsidiary",
        label: "Subsidiary",
        emoji: "🔗",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Subsidiary", "#862e9c", "#f8f0fc", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "group-boundary",
        label: "Group Boundary",
        emoji: "⬜",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 300, 200, "Group", "#7950f2", "transparent", {
            strokeStyle: "dashed",
            strokeWidth: 1,
          }),
      },
      {
        id: "cost-centre",
        label: "Cost Centre",
        emoji: "💰",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 160, 80, "Cost Centre", "#7950f2", "#f3f0ff"),
      },
      {
        id: "third-party",
        label: "Third Party",
        emoji: "🤝",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Third Party", "#868e96", "#f8f9fa", {
            strokeStyle: "dashed",
            roundness: { type: 3, value: 8 },
          }),
      },
    ],
  },

  // ── Devices ──────────────────────────────────────────────────────────────
  {
    title: "Devices",
    items: [
      {
        id: "laptop",
        label: "Laptop",
        emoji: "💻",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Laptop", "#364fc7", "#edf2ff", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "mobile",
        label: "Mobile / Phone",
        emoji: "📱",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 80, 140, "Mobile", "#364fc7", "#edf2ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "tablet",
        label: "Tablet",
        emoji: "📲",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 120, 160, "Tablet", "#364fc7", "#edf2ff", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "printer",
        label: "Printer",
        emoji: "🖨️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 80, "Printer", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "iot-device",
        label: "IoT Device",
        emoji: "📡",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 80, "IoT Device", "#0c8599", "#e3fafc"),
      },
      {
        id: "workstation",
        label: "Workstation",
        emoji: "🖥️",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 100, "Workstation", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
    ],
  },

  // ── Network ───────────────────────────────────────────────────────────────
  {
    title: "Network",
    items: [
      {
        id: "router",
        label: "Router",
        emoji: "📶",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 140, 80, "Router", "#2f9e44", "#ebfbee"),
      },
      {
        id: "switch",
        label: "Switch",
        emoji: "🔀",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Switch", "#2f9e44", "#ebfbee", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "proxy",
        label: "Proxy",
        emoji: "🔄",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "Proxy", "#0c8599", "#e3fafc", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "vpn-gateway",
        label: "VPN Gateway",
        emoji: "🔒",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 60, "VPN Gateway", "#1971c2", "#e7f5ff", {
            roundness: { type: 3, value: 4 },
          }),
      },
      {
        id: "wifi-ap",
        label: "Wi-Fi AP",
        emoji: "📡",
        createElement: (x, y) =>
          labeledShape("ellipse", x, y, 100, 80, "Wi-Fi AP", "#2f9e44", "#ebfbee"),
      },
      {
        id: "dns",
        label: "DNS",
        emoji: "🌐",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 60, "DNS", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 4 },
          }),
      },
    ],
  },

  // ── Security ──────────────────────────────────────────────────────────────
  {
    title: "Security",
    items: [
      {
        id: "idp",
        label: "Identity Provider",
        emoji: "🪪",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 180, 80, "Identity Provider", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "auth-server",
        label: "Auth Server",
        emoji: "🔑",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Auth Server", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "waf",
        label: "WAF",
        emoji: "🛡️",
        createElement: (x, y) =>
          labeledShape("diamond", x, y, 160, 80, "WAF", "#c92a2a", "#fff5f5"),
      },
      {
        id: "secrets-vault",
        label: "Secrets Vault",
        emoji: "🔐",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 140, 80, "Secrets Vault", "#862e9c", "#f8f0fc", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "cert-authority",
        label: "Cert Authority",
        emoji: "📜",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "Cert Authority", "#495057", "#f8f9fa", {
            roundness: { type: 3, value: 8 },
          }),
      },
      {
        id: "siem",
        label: "SIEM",
        emoji: "🔍",
        createElement: (x, y) =>
          labeledShape("rectangle", x, y, 160, 80, "SIEM", "#c92a2a", "#fff5f5", {
            roundness: { type: 3, value: 8 },
          }),
      },
    ],
  },
];
