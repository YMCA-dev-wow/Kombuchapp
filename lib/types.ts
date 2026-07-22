export type Recipe = {
  id: string;
  name: string;
  description: string;
  quantity: number;
  default_restock_quantity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  recipe_id: string | null;
  recipe_name_snapshot: string;
  quantity: number;
  customer_name: string;
  customer_email: string | null;
  status: "confirmee" | "annulee";
  order_type: "vendu" | "donne";
  unit_amount: number | null;
  created_by: "site" | "admin";
  created_at: string;
};

export type CustomOrder = {
  id: string;
  recipe_name: string;
  details: string;
  quantity: number;
  desired_date: string | null;
  customer_name: string;
  customer_email: string | null;
  status: "en_attente" | "validee" | "refusee";
  admin_note: string;
  created_at: string;
};

export type Subscriber = {
  id: string;
  email: string;
  created_at: string;
};
