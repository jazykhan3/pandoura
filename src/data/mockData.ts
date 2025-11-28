import type { ActivityLog, Connection, Tag, LegacyDeploymentLog } from '../types'

export const mockActivities: ActivityLog[] = [
  {
    id: '1',
    message: 'Logic updated: PID_Control_Loop',
    timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 mins ago
  },
  {
    id: '2',
    message: 'Tag sync completed',
    timestamp: new Date(Date.now() - 12 * 60 * 1000), // 12 mins ago
  },
  {
    id: '3',
    message: 'Deployment to PLC-01',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
  },
  {
    id: '4',
    message: 'Connection established: PLC-02',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
  },
]

export const mockConnections: Connection[] = [
  {
    id: '1',
    name: 'PLC-01',
    ip: '192.168.1.100',
    status: 'online',
  },
  {
    id: '2',
    name: 'PLC-02',
    ip: '192.168.1.101',
    status: 'online',
  },
  {
    id: '3',
    name: 'HMI Station',
    ip: '192.168.1.50',
    status: 'warning',
  },
]

export const mockTags: Tag[] = [
  { id: '1', name: 'Motor_Speed', type: 'REAL', value: 1450.5, address: 'DB1.DBD0', lastUpdate: new Date() },
  { id: '2', name: 'Pump_Status', type: 'BOOL', value: true, address: 'DB1.DBX4.0', lastUpdate: new Date() },
  { id: '3', name: 'Temperature_Setpoint', type: 'INT', value: 75, address: 'DB1.DBW8', lastUpdate: new Date() },
  { id: '4', name: 'Conveyor_Enable', type: 'BOOL', value: false, address: 'DB1.DBX4.1', lastUpdate: new Date() },
  { id: '5', name: 'Flow_Rate', type: 'REAL', value: 23.7, address: 'DB1.DBD12', lastUpdate: new Date() },
  { id: '6', name: 'Pressure_Value', type: 'REAL', value: 101.3, address: 'DB1.DBD16', lastUpdate: new Date() },
  { id: '7', name: 'Alarm_Active', type: 'BOOL', value: false, address: 'DB1.DBX4.2', lastUpdate: new Date() },
  { id: '8', name: 'Cycle_Counter', type: 'INT', value: 3421, address: 'DB1.DBW20', lastUpdate: new Date() },
  { id: '9', name: 'Product_Name', type: 'STRING', value: 'Widget_A', address: 'DB1.DBB24', lastUpdate: new Date() },
  { id: '10', name: 'Emergency_Stop', type: 'BOOL', value: false, address: 'DB1.DBX4.3', lastUpdate: new Date() },
]

export const mockDeployments: LegacyDeploymentLog[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
    version: 'v2.1.4',
    status: 'success',
    changes: 7,
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
    version: 'v2.1.3',
    status: 'success',
    changes: 3,
  },
  {
    id: '3',
    timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    version: 'v2.1.2',
    status: 'success',
    changes: 12,
  },
]

export const mockLogicCode = `(* PID Temperature Control Loop *)
PROGRAM Temperature_Control
VAR
  Temperature_PV : REAL := 72.5;      (* Process Variable *)
  Temperature_SP : REAL := 75.0;      (* Setpoint *)
  Heater_Output : REAL := 0.0;        (* Control Output 0-100% *)
  
  (* PID Parameters *)
  Kp : REAL := 2.5;                   (* Proportional Gain *)
  Ki : REAL := 0.1;                   (* Integral Gain *)
  Kd : REAL := 0.5;                   (* Derivative Gain *)
  
  Error : REAL;
  Last_Error : REAL := 0.0;
  Integral : REAL := 0.0;
  Derivative : REAL;
END_VAR

(* Calculate error *)
Error := Temperature_SP - Temperature_PV;

(* Integral accumulation with anti-windup *)
Integral := Integral + Error;
IF Integral > 100.0 THEN Integral := 100.0; END_IF;
IF Integral < -100.0 THEN Integral := -100.0; END_IF;

(* Derivative calculation *)
Derivative := Error - Last_Error;

(* PID Output calculation *)
Heater_Output := (Kp * Error) + (Ki * Integral) + (Kd * Derivative);

(* Clamp output to 0-100% *)
IF Heater_Output > 100.0 THEN 
  Heater_Output := 100.0; 
ELSIF Heater_Output < 0.0 THEN 
  Heater_Output := 0.0;
END_IF;

(* Save error for next cycle *)
Last_Error := Error;

END_PROGRAM
`


