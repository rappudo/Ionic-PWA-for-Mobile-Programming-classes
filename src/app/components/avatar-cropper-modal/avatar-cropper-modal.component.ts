import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonRange,
  IonTitle,
  IonToolbar,
  ModalController,
  RangeCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';

const VIEWPORT_SIZE = 280;
const OUTPUT_SIZE = 512;
const MAX_ZOOM = 3;

@Component({
  selector: 'app-avatar-cropper-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: 'avatar-cropper-modal.component.html',
  styleUrls: ['avatar-cropper-modal.component.scss'],
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonRange,
    IonTitle,
    IonToolbar,
  ],
})
export class AvatarCropperModalComponent implements AfterViewInit, OnDestroy {
  private readonly modalCtrl = inject(ModalController);

  @Input({ required: true }) file!: File;

  private readonly imgRef = viewChild<ElementRef<HTMLImageElement>>('img');

  readonly viewportSize = VIEWPORT_SIZE;
  readonly imageUrl = signal('');
  readonly transform = signal('');
  readonly zoomSliderValue = signal(0);
  readonly processing = signal(false);

  private naturalWidth = 0;
  private naturalHeight = 0;
  private baseScale = 1;
  private userScale = 1;
  private panX = 0;
  private panY = 0;
  private objectUrl: string | null = null;

  private dragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private panStartX = 0;
  private panStartY = 0;
  private pointerHandlers = new Map<number, (ev: PointerEvent) => void>();

  constructor() {
    addIcons({
      'checkmark-outline': checkmarkOutline,
      'close-outline': closeOutline,
    });
  }

  ngAfterViewInit(): void {
    this.objectUrl = URL.createObjectURL(this.file);
    this.imageUrl.set(this.objectUrl);
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  onImageLoad(): void {
    const img = this.imgRef()?.nativeElement;
    if (!img) return;
    this.naturalWidth = img.naturalWidth;
    this.naturalHeight = img.naturalHeight;
    this.baseScale = Math.max(
      VIEWPORT_SIZE / this.naturalWidth,
      VIEWPORT_SIZE / this.naturalHeight,
    );
    this.userScale = 1;
    this.zoomSliderValue.set(0);
    this.panX = (VIEWPORT_SIZE - this.naturalWidth * this.totalScale()) / 2;
    this.panY = (VIEWPORT_SIZE - this.naturalHeight * this.totalScale()) / 2;
    this.applyTransform();
  }

  onPointerDown(event: PointerEvent): void {
    if (!this.naturalWidth) return;
    this.dragging = true;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.dragging) return;
    const dx = event.clientX - this.dragStartX;
    const dy = event.clientY - this.dragStartY;
    this.setPan(this.panStartX + dx, this.panStartY + dy);
    event.preventDefault();
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    const target = event.currentTarget as HTMLElement;
    target.releasePointerCapture(event.pointerId);
  }

  onZoomChange(event: Event): void {
    const value = Number((event as RangeCustomEvent).detail.value);
    this.zoomSliderValue.set(value);
    const newUserScale = 1 + (value / 100) * (MAX_ZOOM - 1);

    const cx = VIEWPORT_SIZE / 2;
    const cy = VIEWPORT_SIZE / 2;
    const sourceX = (cx - this.panX) / this.totalScale();
    const sourceY = (cy - this.panY) / this.totalScale();

    this.userScale = newUserScale;
    const newScale = this.totalScale();

    this.setPan(cx - sourceX * newScale, cy - sourceY * newScale);
  }

  async save(): Promise<void> {
    if (this.processing()) return;
    const img = this.imgRef()?.nativeElement;
    if (!img) return;

    this.processing.set(true);
    const scale = this.totalScale();
    const sx = -this.panX / scale;
    const sy = -this.panY / scale;
    const sw = VIEWPORT_SIZE / scale;
    const sh = VIEWPORT_SIZE / scale;

    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.processing.set(false);
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    this.processing.set(false);
    if (!blob) return;
    void this.modalCtrl.dismiss(blob, 'save');
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  private totalScale(): number {
    return this.baseScale * this.userScale;
  }

  private setPan(x: number, y: number): void {
    const scale = this.totalScale();
    const displayedW = this.naturalWidth * scale;
    const displayedH = this.naturalHeight * scale;
    const minX = VIEWPORT_SIZE - displayedW;
    const minY = VIEWPORT_SIZE - displayedH;
    this.panX = Math.max(minX, Math.min(0, x));
    this.panY = Math.max(minY, Math.min(0, y));
    this.applyTransform();
  }

  private applyTransform(): void {
    const scale = this.totalScale();
    this.transform.set(`translate(${this.panX}px, ${this.panY}px) scale(${scale})`);
  }
}
