import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core'
import { EChartsOption } from 'echarts'
import { ChartsService } from '../../services/charts.service'
import * as echarts from 'echarts'
import { FormControl, FormGroup, Validators } from '@angular/forms'
import { MatDialog } from '@angular/material/dialog'
import { MachineModalComponent } from '../../components/machine-modal/machine-modal.component'
import { MapService } from '../../services/map.service'
import { AgmMarker } from '@agm/core'
import { LiveGpsService } from '../../services/liveGps.service'
import { MachineGPS } from '../../interfaces/interfaces'

declare var Pushbar: any
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  public pushbar: any
  public machines!: MachineGPS[]
  public machinePicked!: string | undefined
  public markers = ['1597', '1729', '1730', '1731', '1732', '1733', '1735', '1736']
  public map: any
  public zoom = 14
  public lat = -33.40904396097648 //Para centralizar el mapa en Las Condes
  public lng = -70.56714105961915 //Para centralizar el mapa en Las Condes
  public latClickMap!: number
  public lngClickMap!: number
  public optionChart1!: EChartsOption
  public optionChart2!: EChartsOption
  public optionChart3!: EChartsOption
  public minDate = new Date()
  public rangeDatePicker = new FormGroup({
    start: new FormControl('', [Validators.required]),
    startTime: new FormControl('', [Validators.required]),
    end: new FormControl('', [Validators.required]),
    endTime: new FormControl('', [Validators.required])
  })

  public showToogle = false
  public showMachineList = true
  public showBusStopsMarkers = false

  constructor(
    private cd: ChangeDetectorRef,
    public charts: ChartsService,
    public mapService: MapService,
    public resService: LiveGpsService,
    public dialog: MatDialog
  ) {}

  ngOnInit() {
    this.pushbar = new Pushbar({ blur: false, overlay: false })
    this.resService.presentLoader()
    this.getDevicesGPS()
    this.getChartData()

    // este metodo es del API de Google Maps te permite consultar direcciones pasandole lat y lng

    this.mapService
      .getAddress(-33.40904396097648, -70.56714105961915)
      .toPromise()
      .then(
        resp => {
          this.latClickMap = -33.40904396097648
          this.lngClickMap = -70.56714105961915
        },
        e => console.log(e)
      )
    // este metodo es del API de Google Maps te permite consultar direcciones pasandole lat y lng
  }

  getDevicesGPS() {
    Promise.all([this.resService.getDevicesGPS().toPromise(), this.mapService.getTotalCurrentPassengers().toPromise()])
      .then(([{ data }, res2]) => {
        let index = 0
        this.machines = data.map(machine => {
          // asociamos la cantidad de pasajeros en vuelta actual a cada bus
          const machineFind = res2.find(c => c.plate == machine.plate)
          if (machineFind) machine['current_passengers'] = machineFind
          // asociamos la cantidad de pasajeros en vuelta actual a cada bus

          // Aqui asignamos los colores de los marcadores a cada bus <--
          if (index >= this.markers.length) {
            index = 0
            machine.marker = this.markers[index]
          } else {
            machine.marker = this.markers[index]
          }
          index++

          return machine // --> Aqui asignamos los colores de los marcadores a cada bus
        })

        this.resService.closeLoader()
      })
      .catch(e => this.resService.closeLoader())
  }

  async getChartData() {
    this.optionChart1 = await this.charts.setOptionsChartsPassengers()
    this.optionChart2 = await this.charts.setOptionsChartsBusesInRoute()
    this.optionChart3 = await this.charts.setOptionsChartsAverageRise()
  }

  openMachineDetailModal(machine: MachineGPS) {
    this.dialog.open(MachineModalComponent, {
      width: '1200px',
      data: { machine }
      /* disableClose: true, */
    })
  }

  //esta funcion se usaria en caso de que se requiera que el marcador de cada bus se abra con el mouseover
  onMouseOver(infoWindow: any, gm: any) {
    if (gm.lastOpen != null) {
      gm.lastOpen.close()
    }

    gm.lastOpen = infoWindow
    infoWindow.open()
  }

  centerBus(plate: string) {
    const findBus = this.machines.findIndex(bus => bus.plate == plate)
    if (findBus >= 0) {
      if (this.map) {
        this.map.setCenter({ lat: this.machines[findBus].lpf.lat, lng: this.machines[findBus].lpf.lng })
        this.map.setZoom(22)
      }
    }
  }

  async machinePick(picked: MachineGPS) {
    this.resService.presentLoader()

    this.machinePicked = `${picked.name} (${picked.plate})`
    this.charts.plate = picked.plate // para filtrar toda la data por numero de placa de bus
    document.getElementById('btnAccordion3')?.click()
    this.optionChart3 = await this.charts.setOptionsChartsAverageRise()

    this.resService.closeLoader()
  }

  async restore() {
    this.resService.presentLoader()

    this.machinePicked = undefined
    this.charts.plate = undefined
    document.getElementById('btnAccordion3')?.click()
    this.optionChart3 = await this.charts.setOptionsChartsAverageRise()

    this.resService.closeLoader()
  }

  filter() {
    document.getElementById('btnAccordion2')?.click()
  }

  datePicker() {}

  hoverFilters(personalizado: HTMLElement) {
    personalizado.classList.add('hover-filters')
  }

  showBusStops() {
    this.showBusStopsMarkers = true
    this.showToogle = true
  }

  hideBusStops() {
    this.showBusStopsMarkers = false
    this.showToogle = false
  }

  public mapReady(map: any) {
    this.map = map
  }

  /* Evento click en cualquier parte del mapa */
  seeCoords(event: any) {
    this.latClickMap = event.coords.lat
    this.lngClickMap = event.coords.lng
  }

  ngOnDestroy() {
    /* this.aside.nativeElement.style.display = 'none' */
  }
}
