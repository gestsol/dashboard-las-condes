import { Component, OnInit, ChangeDetectorRef } from '@angular/core'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { ChartsService } from '../../services/charts.service'
import { LiveGpsService } from '../../services/liveGps.service'
import { forkJoin, Subscription } from 'rxjs'
import { MachineGPS, TotalPasajeros, PromedioPasajeros } from '../../interfaces/interfaces'

import * as moment from 'moment'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { EChartsOption } from 'echarts'
import { GeoZonesService } from '@SERVICES/geo-zones.service'

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics.component.html',
  styleUrls: ['./statistics.component.scss']
})
export class StatisticsComponent implements OnInit {
  /////// Contadores
  public totalPassengers!: number | string
  public averagePassengers!: number | string
  public totalMachines!: number | string
  //////// Graficas
  public dataChartsSub!: Subscription
  public optionChart1!: EChartsOption
  public optionChart2!: EChartsOption

  public machines!: MachineGPS[]
  public machinePicked!: string | undefined
  public minDate = new Date()

  public exportXLSX: Function[] = Array(2).fill(() => null)
  public geoZonesEnters: TGeoZoneByPassengerFlow[] = []
  public geoZonesExits: TGeoZoneByPassengerFlow[] = []
  public geoZonesFieldsTemplate = (flow: 'Salida' | 'Entrada'): TTableField[] => [
    { key: 'time', label: `Hora ${flow}`, wch: 10 },
    { key: 'machine', label: 'Nro. Máquina / Patente', wch: 20 },
    // { key: 'route', label: 'Ruta', wch: 25 },
    { key: 'geozone', label: 'Paradero', wch: 25 },
    { key: 'passengers', label: 'Cant. de pasajeros', wch: 20 }
  ]
  public geoZonesFieldsEnters = this.geoZonesFieldsTemplate('Entrada')
  public geoZonesFieldsExits = this.geoZonesFieldsTemplate('Salida')

  constructor(
    private cd: ChangeDetectorRef,
    public charts: ChartsService,
    public resService: LiveGpsService,
    public geoZonesService: GeoZonesService
  ) {}

  public rangeDatePicker = new FormGroup({
    start_date: new FormControl('', [Validators.required]),
    startTime: new FormControl('', [Validators.required]),
    end_date: new FormControl('', [Validators.required]),
    endTime: new FormControl('', [Validators.required])
  })

  ngOnInit(): void {
    this.resService.presentLoader()
    this.getChartData()
    this.getData()
  }

  async getChartData() {
    const res = this.resService

    this.dataChartsSub = forkJoin([
      this.charts.getTotalPassengers('today'),
      this.charts.getAveragePassengersByTimeToday(),
      this.resService.getDevicesGPS(),
      this.charts.getTotalActiveMachinesToday()
    ]).subscribe(
      ([res1, res2, { data }, res4]) => {
        //Total de pasajeros
        this.totalPassengers = res == null ? '0' : res1['total_pasajeros']
        //Promedio de Pasajeros
        this.averagePassengers =
          res2.length == 0 ? '0' : this.calculateAverage(res2.map(item => +item.promedio_pasajeros)).replace('.', ',')
        //Total de Buses
        this.totalMachines = res4.length

        this.machines = data
        res.closeLoader()
      },
      () => res.closeLoader()
    )

    this.optionChart1 = await this.charts.setOptionsChartsBoardingPassengers()
    this.optionChart2 = await this.charts.setOptionsChartsBarDisembarkationPassengers()
  }

  private async getData() {
    this.geoZonesEnters = await this.loadFlowByGeoZones('enters')
    this.geoZonesExits = await this.loadFlowByGeoZones('exits')
  }

  private async loadFlowByGeoZones(flow: TBodyAforo['flowByGeoZones']['flow']): Promise<TGeoZoneByPassengerFlow[]> {
    const flowByGeoZones = await this.geoZonesService.getFlowByGeoZones({
      flow,
      date: moment().format('YYYY-MM-DD')
    })

    return (
      flowByGeoZones?.map(bus => {
        const { date, plate, geozone } = bus

        return <TGeoZoneByPassengerFlow>{
          time: moment(date).format('HH:mm:ss'),
          machine: plate,
          geozone,
          passengers: (bus?.entradas_pasajeros || bus?.salidas_pasajeros)!.toString()
        }
      }) || []
    )
  }

  async filterData(date: 'today' | 'this_week' | 'this_month') {
    document.getElementById('btnAccordion2')?.click()
    this.resService.presentLoader()

    const renderData = (res: TotalPasajeros, res2: PromedioPasajeros[], res3: any, res4: any) => {
      this.totalPassengers = res == null ? '0' : res.total_pasajeros
      this.averagePassengers =
        res2.length == 0 ? '0' : this.calculateAverage(res2.map(item => +item.promedio_pasajeros)).replace('.', ',')
      this.optionChart1 = res3
      this.optionChart2 = res4
      this.resService.closeLoader()
    }

    if (date == 'today') {
      Promise.all([
        this.charts.getTotalPassengers(date).toPromise(),
        this.charts.getAveragePassengersByTimeToday().toPromise(),
        this.charts.setOptionsChartsBoardingPassengers(),
        this.charts.setOptionsChartsBarDisembarkationPassengers()
      ]).then(([res, res2, res3, res4]) => {
        renderData(res, res2, res3, res4)
      })
    }

    if (date == 'this_week') {
      Promise.all([
        this.charts.getTotalPassengers(date).toPromise(),
        this.charts.getAveragePassengersByDay(date).toPromise(),
        this.charts.setOptionsChartsBoardingPassengers(date),
        this.charts.setOptionsChartsBarDisembarkationPassengers(date)
      ]).then(([res, res2, res3, res4]) => {
        renderData(res, res2, res3, res4)
      })
    }

    if (date == 'this_month') {
      Promise.all([
        this.charts.getTotalPassengers(date).toPromise(),
        this.charts.getAveragePassengersByDay(date).toPromise(),
        this.charts.setOptionsChartsBoardingPassengers(date),
        this.charts.setOptionsChartsBarDisembarkationPassengers(date)
      ]).then(([res, res2, res3, res4]) => {
        renderData(res, res2, res3, res4)
      })
    }
  }

  filterByDatePicker() {
    this.resService.presentLoader()
    let params = this.rangeDatePicker.value

    params.start_date = moment(params.start_date).format('YYYY-MM-DD')
    params.end_date = moment(params.end_date).format('YYYY-MM-DD')
    params.startTime = params.startTime.indexOf(':59') > 0 ? params.startTime : params.startTime + ':59'
    params.endTime = params.endTime.indexOf(':59') > 0 ? params.endTime : params.endTime + ':59'

    const start_date = params.start_date + ' ' + params.startTime
    const end_date = params.end_date + ' ' + params.endTime

    Promise.all([
      this.charts.getTotalPassengersByRangeDate(start_date, end_date).toPromise(),
      this.charts.getAveragePassengersByDayByRange(start_date, end_date).toPromise(),
      this.charts.setOptionsChartsBoardingPassengers(undefined, start_date, end_date),
      this.charts.setOptionsChartsBarDisembarkationPassengers(undefined, start_date, end_date)
    ]).then(([res1, res2, res3, res4]) => {
      this.totalPassengers = res1.total_pasajeros
      this.averagePassengers = this.calculateAverage(res2.map(item => +item.promedio_pasajeros)).replace('.', ',')
      this.optionChart1 = res3
      this.optionChart2 = res4
      this.resService.closeLoader()
    })

    document.getElementById('btnAccordion2')?.click()
  }

  machinePick(picked: MachineGPS) {
    this.machinePicked = `${picked.name} (${picked.plate})`
    this.charts.plate = picked.plate // para filtrar toda la data por numero de placa de bus
    document.getElementById('btnAccordion3')?.click()
  }

  restore() {
    this.machinePicked = undefined
    this.charts.plate = undefined
    document.getElementById('btnAccordion3')?.click()
  }

  datePicker() {}

  hoverFilters(personalizado: HTMLElement) {
    personalizado.classList.add('hover-filters')
  }

  //Calcular Promedio pasando un array de numeros como data
  calculateAverage = (data: Array<number>) =>
    (data.reduce((prev, current) => prev + current, 0) / data.length).toFixed(2)

  async exportData() {
    this.resService.presentLoader()
    //Para exportar a PDF las graficas
    let DATA = document.getElementById('htmlData')!

    await html2canvas(DATA).then(canvas => {
      /* let fileWidth = 290;
        let fileHeight = canvas.height * fileWidth / canvas.width; */

      const FILEURI = canvas.toDataURL('image/png')
      let PDF = new jsPDF('l', 'pt', 'a4')
      let position = 0
      let pageSize = PDF.internal.pageSize
      PDF.addImage(FILEURI, 'PNG', 0, position, pageSize.getWidth(), pageSize.getHeight())

      PDF.save('estadisticas.pdf')
    })

    this.exportXLSX[0]()
    this.exportXLSX[1]()

    this.resService.closeLoader()
  }

  ngOnDestroy() {
    if (this.dataChartsSub) {
      this.dataChartsSub.unsubscribe()
    }
  }
}
